import {
  createInvoice,
  getQuickBooksConnection,
  sql,
  refreshClientNextInvoiceDue
} from "@/lib/db";
import {
  createQuickBooksInvoice,
  updateQuickBooksInvoiceLineItem,
  extractQuickBooksInvoiceState,
  sendQuickBooksInvoiceEmail,
  getQuickBooksItems,
  findQuickBooksItemByName
} from "@/lib/quickbooks";
import { ensureQuickBooksCustomer } from "@/lib/quickbooks-sync";

function parseISODate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getMaintenanceFeeDetails(plan: string | null, frequency: string | null) {
  if (plan === "Starter") {
    if (frequency === "Monthly") {
      return { itemName: "Maintenance Fee - Starter Plan (Monthly)", amount: 10, description: "Maintenance Fee - Starter Plan (Monthly)" };
    }
    if (frequency === "Yearly") {
      return { itemName: "Maintenance Fee - Starter Plan (Yearly)", amount: 100, description: "Maintenance Fee - Starter Plan (Yearly)" };
    }
  } else if (plan === "Feature-Rich") {
    if (frequency === "Monthly") {
      return { itemName: "Maintenance Fee - Feature-Rich Plan (Monthly)", amount: 20, description: "Maintenance Fee - Feature-Rich Plan (Monthly)" };
    }
    if (frequency === "Yearly") {
      return { itemName: "Maintenance Fee - Feature-Rich Plan (Yearly)", amount: 200, description: "Maintenance Fee - Feature-Rich Plan (Yearly)" };
    }
  }
  return null;
}

export async function resolveItemAmount(realmId: string, itemName: string, fallbackAmount: number): Promise<number> {
  try {
    const item = await findQuickBooksItemByName(realmId, itemName);
    
    // If the item exists in QBO and has a price > 0, prioritize the QBO price.
    if (item && typeof item.UnitPrice === "number" && item.UnitPrice > 0) {
      return item.UnitPrice;
    }
  } catch (error) {
    console.error(`Failed to resolve dynamic rate for QBO Item "${itemName}", using fallback ${fallbackAmount}:`, error);
  }
  
  // Use the hardcoded value ONLY as a fallback if the QBO item is missing or has a 0 price.
  return fallbackAmount;
}

export function getCandidateMaintenanceInvoices(
  startDateStr: string,
  plan: string,
  frequency: string,
  todayStr: string
): { invoiceDate: string; dueDate: string }[] {
  const start = parseISODate(startDateStr);
  const todayUTC = parseISODate(todayStr);
  const tomorrowUTC = new Date(todayUTC);
  tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);

  const candidates: { invoiceDate: string; dueDate: string }[] = [];

  if (frequency === "Monthly") {
    let i = 1;
    while (true) {
      const dueDateOfM = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 15));
      const dueDateStr = formatISODate(dueDateOfM);
      
      let postDateStr: string;
      if (i === 1) {
        postDateStr = startDateStr;
      } else {
        const postDateOfM = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i - 1, 16));
        postDateStr = formatISODate(postDateOfM);
      }
      
      const postDate = parseISODate(postDateStr);
      
      // "Same-Day Activation" Buffer.
      // Allow a 2-day "drift window" to account for 
      // UTC rollover between user's local time and server time.
      const diffInDays = (postDate.getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24);

      if (postDate > tomorrowUTC) {
        if (diffInDays > 2) {
          break;
        }
      }

      candidates.push({
        invoiceDate: postDateStr,
        dueDate: dueDateStr,
      });

      i++;
      if (i > 200) break;
    }
  } else if (frequency === "Yearly") {
    let k = 1;
    while (true) {
      const dueYear = start.getUTCFullYear() + k;
      const dueMonth = start.getUTCMonth();
      
      const dueDateOfK = new Date(Date.UTC(dueYear, dueMonth, 15));
      const dueDateStr = formatISODate(dueDateOfK);
      
      const postDateOfK = new Date(Date.UTC(dueYear, dueMonth - 2, 16));
      const postDateStr = formatISODate(postDateOfK);
      const postDate = parseISODate(postDateStr);
      if (postDate > tomorrowUTC) {
        break;
      }

      candidates.push({
        invoiceDate: postDateStr,
        dueDate: dueDateStr,
      });

      k++;
      if (k > 50) break;
    }
  }

  return candidates;
}

export async function generateMaintenanceInvoicesForClient(clientId: string): Promise<{ totalCreated: number }> {
  const clientResult = await sql`
    SELECT id, company_name, email, plan, service_status, client_status, maintenance_fee_frequency, service_start_date
    FROM clients
    WHERE id = ${clientId}
  `;
  const client = clientResult.rows[0];
  if (!client) {
    return { totalCreated: 0 };
  }

  if (
    client.client_status !== "Active" ||
    client.service_status !== "Active" ||
    !client.plan ||
    !client.maintenance_fee_frequency ||
    !client.service_start_date
  ) {
    return { totalCreated: 0 };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const startDateStr = client.service_start_date instanceof Date 
    ? formatISODate(client.service_start_date)
    : String(client.service_start_date).slice(0, 10);

  const candidates = getCandidateMaintenanceInvoices(
    startDateStr,
    client.plan,
    client.maintenance_fee_frequency,
    todayStr
  );

  let createdCount = 0;

  for (const candidate of candidates) {
    const existingResult = await sql`
      SELECT id FROM invoices
      WHERE client_id = ${clientId}
        AND due_date = ${candidate.dueDate}
      LIMIT 1
    `;
    if (existingResult.rows.length > 0) {
      continue;
    }

    const connection = await getQuickBooksConnection();
    if (!connection) {
      console.warn(`[Maintenance Invoicing] QuickBooks not connected; skipping invoice for client ${clientId}`);
      continue;
    }

    const customerId = await ensureQuickBooksCustomer(clientId);
    const details = getMaintenanceFeeDetails(client.plan, client.maintenance_fee_frequency);
    if (!details) continue;

    const dynamicAmount = await resolveItemAmount(connection.realm_id, details.itemName, details.amount);

    const qboInvoice = await createQuickBooksInvoice(connection.realm_id, {
      customerId,
      amountDue: dynamicAmount,
      invoiceDate: candidate.invoiceDate,
      dueDate: candidate.dueDate,
      description: details.description,
      itemName: details.itemName,
      email: client.email || undefined,
      termName: "Net 15",
    });

    const qboState = extractQuickBooksInvoiceState(qboInvoice);

    await createInvoice({
      client_id: clientId,
      invoice_total: qboState.invoiceTotal,
      invoice_date: qboState.invoiceDate || candidate.invoiceDate,
      due_date: candidate.dueDate,
      qbo_payment_url: qboState.paymentUrl,
      qbo_invoice_id: qboState.qboInvoiceId,
      qbo_doc_number: qboState.qboDocNumber,
      qbo_sync_status: qboState.qboSyncStatus,
      amount_paid: qboState.amountPaid,
      paid_at: qboState.paidAt,
      is_manual_link: false,
      notes: details.description,
    });

    if (client.email) {
      try {
        await sendQuickBooksInvoiceEmail(connection.realm_id, qboState.qboInvoiceId, client.email);
      } catch (emailError) {
        console.error("Failed to send QuickBooks maintenance invoice email:", emailError);
      }
    }

    createdCount++;
  }

  if (createdCount > 0) {
    await refreshClientNextInvoiceDue(clientId);
  }

  return { totalCreated: createdCount };
}

export async function updateUnpaidMaintenanceInvoices(
  clientId: string,
  finalPlan: string,
  finalFrequency: string
): Promise<void> {
  const clientResult = await sql`
    SELECT id, plan, maintenance_fee_frequency
    FROM clients
    WHERE id = ${clientId}
  `;
  const client = clientResult.rows[0];
  if (!client) return;

  const oldPlan = client.plan;
  const oldFrequency = client.maintenance_fee_frequency;

  if (oldFrequency === "Yearly" && finalFrequency === "Monthly" && oldPlan === finalPlan) {
    return;
  }

  const details = getMaintenanceFeeDetails(finalPlan, finalFrequency);
  if (!details) return;

  const unpaidInvoicesResult = await sql`
    SELECT id, qbo_invoice_id, notes
    FROM invoices
    WHERE client_id = ${clientId}
      AND paid_at IS NULL
      AND LOWER(COALESCE(qbo_sync_status, 'pending')) <> 'paid'
  `;

  const unpaidMaintenance = unpaidInvoicesResult.rows.filter(
    (inv) => inv.notes && inv.notes.includes("Maintenance Fee") && inv.qbo_invoice_id
  );

  if (unpaidMaintenance.length === 0) return;

  const connection = await getQuickBooksConnection();
  if (!connection) {
    console.warn(`[Maintenance Invoicing] QuickBooks not connected; skipping unpaid update for client ${clientId}`);
    return;
  }

  const dynamicAmount = await resolveItemAmount(connection.realm_id, details.itemName, details.amount);

  for (const inv of unpaidMaintenance) {
    try {
      await updateQuickBooksInvoiceLineItem(connection.realm_id, {
        qboInvoiceId: inv.qbo_invoice_id,
        itemName: details.itemName,
        amountDue: dynamicAmount,
        description: details.description,
      });

      await sql`
        UPDATE invoices
        SET notes = ${details.description},
            invoice_total = ${dynamicAmount},
            last_synced_at = NOW()
        WHERE id = ${inv.id}
      `;
    } catch (error) {
      console.error(`Failed to update unpaid QBO invoice ${inv.qbo_invoice_id}:`, error);
    }
  }

  await refreshClientNextInvoiceDue(clientId);
}

export async function processAllMaintenanceInvoices(): Promise<{ totalCreated: number }> {
  const activeClientsResult = await sql`
    SELECT id
    FROM clients
    WHERE service_status = 'Active'
      AND client_status = 'Active'
      AND plan IS NOT NULL
      AND maintenance_fee_frequency IS NOT NULL
      AND service_start_date IS NOT NULL
  `;

  let grandTotal = 0;
  for (const row of activeClientsResult.rows) {
    try {
      const result = await generateMaintenanceInvoicesForClient(String(row.id));
      grandTotal += result.totalCreated;
    } catch (error) {
      console.error(`Failed executing maintenance invoice sync for client ${row.id}:`, error);
    }
  }

  return { totalCreated: grandTotal };
}
