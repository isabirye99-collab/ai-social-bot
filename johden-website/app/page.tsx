const services = [
  {
    number: "01",
    title: "Business Consultancy",
    description:
      "Practical guidance to help you plan confidently, strengthen operations and turn business ideas into sustainable ventures.",
    items: ["Business plans & feasibility studies", "Strategy & business development", "Company registration support", "Proposals, grants & tender support"],
  },
  {
    number: "02",
    title: "Marketing & Branding",
    description:
      "Build a distinctive brand, reach the right audience and turn attention into meaningful customer relationships.",
    items: ["Digital marketing & social media", "Brand identity & graphic design", "Market research & campaign planning", "SEO & online visibility"],
  },
  {
    number: "03",
    title: "Software & Technology",
    description:
      "Use technology to simplify work, improve customer experiences and give your organisation room to grow.",
    items: ["Websites & web applications", "Billing, invoicing & expense systems", "CRM & workflow automation", "Database and business dashboards"],
  },
  {
    number: "04",
    title: "Research & Analytics",
    description:
      "Make better decisions with structured research, reliable analysis and clear reporting that turns data into insight.",
    items: ["Research design & data analysis", "Monitoring & evaluation", "Statistical reports & visualisations", "Business intelligence dashboards"],
  },
  {
    number: "05",
    title: "Creative & Corporate Services",
    description:
      "Present your organisation with clarity and confidence across proposals, reports, presentations and campaigns.",
    items: ["Company profiles & brochures", "Professional proposals & reports", "Presentation design", "Event and campaign branding"],
  },
  {
    number: "06",
    title: "Business Support",
    description:
      "Get dependable support for the essential work that helps your business operate professionally and pursue new opportunities.",
    items: ["Documentation & business communications", "Tender documentation support", "Project planning", "Operational process improvement"],
  },
];

const steps = [
  { number: "01", title: "Tell us your goal", description: "Share the challenge, opportunity or idea you want to move forward." },
  { number: "02", title: "Get a clear plan", description: "We discuss the scope, recommend a practical approach and agree on deliverables." },
  { number: "03", title: "Build and improve", description: "We work with you to deliver a useful solution and identify the next steps." },
];

export default function Home() {
  return (
    <main>
      <div className="announcement">
        <span className="announcement-dot" />
        Business consultancy, marketing and technology — built around your goals.
      </div>

      <header className="site-header">
        <a className="brand" href="#home" aria-label="Johden home">
          <span className="brand-mark">J<span>.</span></span>
          <span className="brand-copy"><strong>JOHDEN</strong><small>BUSINESS CONSULTANCY SERVICES</small></span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#services">Services</a>
          <a href="#about">About us</a>
          <a href="#products">Technology</a>
          <a href="#process">How we work</a>
        </nav>
        <a className="button button-dark header-cta" href="#contact">Let’s talk <span>↗</span></a>
      </header>

      <section className="hero" id="home">
        <div className="hero-content">
          <div className="eyebrow"><span /> YOUR PARTNER IN PROGRESS</div>
          <h1>Good ideas deserve <em>great execution.</em></h1>
          <p className="hero-lede">
            We help businesses build stronger foundations, connect with the right customers and use technology to work smarter.
          </p>
          <div className="hero-actions">
            <a className="button button-gold" href="#contact">Discuss your project <span>↗</span></a>
            <a className="text-link" href="#services">Explore our services <span>↓</span></a>
          </div>
          <div className="hero-proof">
            <div className="proof-icon">✳</div>
            <p><strong>One partner. Multiple capabilities.</strong><br />Business thinking meets creative and technical delivery.</p>
          </div>
        </div>
        <div className="hero-art" aria-label="Abstract navy and gold business graphic">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-glow" />
          <div className="art-panel">
            <div className="panel-top"><span>JOHDEN / STRATEGY & GROWTH</span><span>✳</span></div>
            <div className="panel-rule" />
            <div className="art-monogram">J<span>.</span></div>
            <div className="panel-bottom"><span>IDEAS INTO ACTION</span><span>EST. FOR WHAT’S NEXT</span></div>
          </div>
          <div className="floating-card floating-card-top"><span className="mini-icon">↗</span><span><small>YOUR NEXT CHAPTER</small><strong>Starts with a plan.</strong></span></div>
          <div className="floating-card floating-card-bottom"><span className="signal-bars"><i /><i /><i /><i /></span><span><small>BUSINESS + TECHNOLOGY</small><strong>Built to move you forward.</strong></span></div>
          <div className="art-caption">CLARITY <span>•</span> CREATIVITY <span>•</span> PROGRESS</div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Johden capabilities">
        <span>BUSINESS STRATEGY</span><i /><span>BRAND & MARKETING</span><i /><span>SOFTWARE SOLUTIONS</span><i /><span>RESEARCH & INSIGHT</span>
      </section>

      <section className="section services-section" id="services">
        <div className="section-heading">
          <div><div className="eyebrow dark-eyebrow"><span /> WHAT WE DO</div><h2>Everything you need to<br /><em>move business forward.</em></h2></div>
          <p>From the first idea to the next stage of growth, we bring together the right thinking, skills and tools to help you make progress.</p>
        </div>
        <div className="services-grid">
          {services.map((service) => (
            <article className="service-card" key={service.number}>
              <div className="service-card-top"><span className="service-number">{service.number}</span><span className="service-arrow">↗</span></div>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <ul>{service.items.map((item) => <li key={item}><span>+</span>{item}</li>)}</ul>
              <a className="card-link" href="#contact">Talk to us about this <span>→</span></a>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section" id="about">
        <div className="about-visual">
          <div className="about-frame">
            <div className="frame-kicker">A BETTER WAY FORWARD</div>
            <div className="frame-lines"><span /><span /><span /><span /><span /></div>
            <div className="frame-statement">Think clearly.<br /><em>Build boldly.</em><br />Grow sustainably.</div>
            <div className="frame-seal">J<span>.</span></div>
            <div className="frame-footer"><span>BUSINESS, REIMAGINED</span><span>JOHDEN</span></div>
          </div>
        </div>
        <div className="about-copy">
          <div className="eyebrow"><span /> ABOUT JOHDEN</div>
          <h2>Practical thinking.<br /><em>Meaningful progress.</em></h2>
          <p>Every business has different ambitions and different challenges. Johden brings consultancy, creativity and technology together to help you take the next step with confidence.</p>
          <p>We believe good work starts with listening, grows through collaboration and succeeds when it creates value you can actually use.</p>
          <div className="value-list">
            <div><span>01</span><p><strong>Understand first</strong><small>We start with your goals, context and customers.</small></p></div>
            <div><span>02</span><p><strong>Make it practical</strong><small>Clear recommendations, purposeful design and useful solutions.</small></p></div>
            <div><span>03</span><p><strong>Focus on outcomes</strong><small>Work designed to help you take measurable next steps.</small></p></div>
          </div>
          <a className="button button-outline" href="#contact">Get to know us <span>↗</span></a>
        </div>
      </section>

      <section className="technology-section" id="products">
        <div className="technology-copy">
          <div className="eyebrow"><span /> OUR TECHNOLOGY PRACTICE</div>
          <h2>Less busywork.<br /><em>More business.</em></h2>
          <p>We design digital tools that help organisations bring their work together. From a professional website to custom business software, we turn everyday needs into simpler workflows.</p>
          <ul className="technology-list">
            <li><span>✓</span> Websites and customer-facing experiences</li>
            <li><span>✓</span> Billing, invoicing and expense management</li>
            <li><span>✓</span> Customer relationship management systems</li>
            <li><span>✓</span> Reporting, dashboards and automation</li>
          </ul>
          <a className="button button-gold" href="#contact">Explore a technology solution <span>↗</span></a>
        </div>
        <div className="dashboard-visual" aria-label="Illustrative business software dashboard">
          <div className="dashboard-window">
            <div className="dashboard-chrome"><div><i /><i /><i /></div><span>JOHDEN WORKSPACE</span><span>•••</span></div>
            <div className="dashboard-body">
              <aside className="dashboard-side"><div className="dashboard-logo">J<span>.</span></div><b>Overview</b><span>Invoices</span><span>Expenses</span><span>Customers</span><span>Reports</span></aside>
              <div className="dashboard-main">
                <div className="dashboard-welcome"><small>BUSINESS OVERVIEW</small><strong>Good morning.</strong><span>Your work, in one place.</span></div>
                <div className="metric-row"><div><small>INVOICES</small><strong>Overview</strong><span className="metric-line" /></div><div><small>EXPENSES</small><strong>Track costs</strong><span className="metric-line line-short" /></div></div>
                <div className="chart-card"><div><strong>Business at a glance</strong><small>Illustrative dashboard concept</small></div><div className="chart-bars">{[32,49,40,63,45,75,57,88,65,78,54,95].map((height, i) => <i key={i} style={{ height: height + "%" }} />)}</div></div>
                <div className="dashboard-bottom"><span>Designed around your workflow</span><span className="gold-dot" /></div>
              </div>
            </div>
          </div>
          <div className="dashboard-note"><span>✳</span><p><strong>Made for your business</strong><small>Thoughtful tools. Clearer workflows.</small></p></div>
        </div>
      </section>

      <section className="process-section section" id="process">
        <div className="eyebrow dark-eyebrow"><span /> HOW WE WORK</div>
        <div className="section-heading process-heading"><h2>A clear path from<br /><em>challenge to progress.</em></h2><p>No unnecessary complexity. Just a collaborative process that keeps your goals at the centre of the work.</p></div>
        <div className="process-grid">{steps.map((step) => <article className="process-card" key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
      </section>

      <section className="cta-section" id="contact">
        <div className="cta-decoration">J<span>.</span></div>
        <div className="eyebrow"><span /> YOUR NEXT STEP STARTS HERE</div>
        <h2>Let’s make something<br /><em>worth moving forward.</em></h2>
        <p>Tell us what you are working on. We’ll help you explore the right next step for your business.</p>
        <div className="cta-actions">
          <a className="button button-gold" href="https://johden.my.canva.site/" target="_blank" rel="noreferrer">Start a conversation <span>↗</span></a>
          <a className="cta-email" href="https://johden.my.canva.site/" target="_blank" rel="noreferrer">Email us about your project</a>
        </div>
        <small className="contact-note">Temporary contact link opens the current Johden website; confirm official contact details before launch.</small>
      </section>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#home"><span className="brand-mark">J<span>.</span></span><span className="brand-copy"><strong>JOHDEN</strong><small>BUSINESS CONSULTANCY SERVICES</small></span></a>
        <p>Strategy. Growth. Technology.</p>
        <div className="footer-links"><a href="#services">Services</a><a href="#about">About</a><a href="#products">Technology</a><a href="#contact">Contact</a></div>
        <small>© {new Date().getFullYear()} Johden Business Consultancy Services. All rights reserved.</small>
      </footer>
    </main>
  );
}