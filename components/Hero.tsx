'use client';

export default function Hero() {
  return (
    <section className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white pt-32 pb-20 px-6">
      <div className="container mx-auto grid md:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
        <div>
          <div className="inline-block px-4 py-2 bg-blue-100 rounded-full mb-6">
            <span className="text-sm font-semibold text-blue-700">
              🚀 Modern Tech Solutions
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-gray-900 mb-6">
            Transform Your Business with Cutting-Edge Technology
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-xl">
            We build exceptional web applications, AI automation, and mobile solutions that drive growth
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="#contact" className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-center">
              Get Started
            </a>
            <a href="#services" className="px-8 py-3 border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors text-center">
              Learn More
            </a>
          </div>
        </div>

        <div className="flex justify-center md:justify-end">
          <div className="w-[480px] max-w-full aspect-square bg-gradient-to-br from-blue-200 to-blue-100 rounded-2xl flex items-center justify-center text-blue-600 text-6xl">
            {/* Logo placeholder */}
            💼
          </div>
        </div>
      </div>
    </section>
  );
}
