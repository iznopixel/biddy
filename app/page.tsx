import { InquiryForm } from './inquiry-form';

export default function Home() {
  return (
    <main className="shell">
      <section className="intro" aria-labelledby="title">
        <img className="logo" src="/brand" alt="OZ Construction LLC, Santa Barbara, CA" width={800} height={454} />
        <div className="intro-copy">
          <h1 id="title">Tell us about<br />your project.</h1>
          <p>Share what you’re planning and where the work will take place. We’ll review your inquiry and follow up about next steps.</p>
        </div>
      </section>
      <section className="card" aria-labelledby="inquiry-title">
        <h2 id="inquiry-title">Project inquiry</h2>
        <InquiryForm />
      </section>
    </main>
  );
}
