import { Brand } from './art';
import ContactForm from './contact-form';
import '../app/legal.css';

const updated = '21 October 2026';

function LegalLayout({ type, title, intro, children }) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Brand />
        <a href="/discover">Back to the good stuff <span aria-hidden="true">↗</span></a>
      </header>
      <main id="main-content">
        <div className="legal-hero">
          <span className="eyebrow">THE SMALL PRINT, IN HUMAN.</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <span className="legal-updated">Last updated {updated}</span>
        </div>
        <div className="legal-body">
          <nav className="legal-nav" aria-label="Policies">
            <a href="/privacy" aria-current={type === 'privacy' ? 'page' : undefined}>Privacy policy</a>
            <a href="/terms" aria-current={type === 'terms' ? 'page' : undefined}>Terms of service</a>
            <a href="#contact">Contact the team ↗</a>
          </nav>
          <article className="legal-copy">
            {children}
            <section id="contact" className="legal-contact">
              <span className="eyebrow">A REAL PERSON READS THESE</span>
              <h2>Need a hand?</h2>
              <p>Send the tadgobble team a question, a correction, or a request about your information. This goes to our private inbox, not a public comment. We may ask you to verify account ownership before changing or releasing account information.</p>
              <ContactForm topic={type === 'privacy' ? 'Privacy request' : 'Terms question'} />
            </section>
          </article>
        </div>
      </main>
      <footer className="legal-footer"><Brand /><p>Good finds. Clear boundaries.</p><a href="/">Back to tadgobble ↗</a></footer>
    </div>
  );
}

export function PrivacyPage() {
  return <LegalLayout type="privacy" title="Privacy policy." intro="Your stash is yours. Here’s what tadgobble collects, what it’s for, and how to ask us to remove it.">
    <section><h2>Who this is for</h2><p>This policy explains how the tadgobble team handles information on tadgobble.web.app, our product-discovery community. It covers browsing, signing in, saving discoveries, commenting, submitting products, and contacting us.</p></section>
    <section><h2>What we collect</h2><ul>
      <li><strong>Account information:</strong> your display name, email address, account identifier, and sign-in information. Existing email/password accounts use a password hash; we do not store their plain-text passwords.</li>
      <li><strong>What you share:</strong> product details, website links, screenshots or uploaded covers, comments, saved discoveries, and messages you send us.</li>
      <li><strong>Basic activity:</strong> page visits, product views, outbound link clicks, campaign sources, timestamps, and a pseudonymous browser identifier. Requests also carry network information used by our providers to deliver and protect the service.</li>
    </ul></section>
    <section><h2>Signing in with Google</h2><p>When you choose Google sign-in, Google shares your account identifier, email address, verification information, and basic profile information such as your name and profile picture. Supabase stores this authentication information for tadgobble. We use it to create or identify your account, sign you in, and associate your activity with that account.</p><p>We do not receive your Google password or request access to Gmail messages, contacts, calendars, or Drive files. We do not sell Google user data, use it for advertising profiles, or use it to train AI models.</p><p>You can remove tadgobble’s Google connection in your <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">Google Account connections</a>. Removing that connection does not itself delete your tadgobble account or its content; account deletion is described below.</p></section>
    <section><h2>Why we use it</h2><p>We use information to run your account and saved collection, display comments and approved products, review submissions, respond to requests, understand which discoveries people find useful, and prevent spam or misuse. We do not sell your personal information.</p></section>
    <section><h2>What’s public, and what isn’t</h2><p>Approved product listings, their covers, and comments are public. Your display name can appear with your comments or submitted product. Your email, saved collection, pending submissions, and contact messages are not public. The team can access submissions and messages to review and manage them.</p><p>Listings and covers can remain after account deletion with the account association removed. If you want a listing, image, or personal information within it removed, contact us below. Previously shared images or cached copies may take time to disappear.</p></section>
    <section><h2>Services that help us run tadgobble</h2><p>Google Firebase Hosting serves the website. Supabase provides authentication, our database, and file storage. Google handles Google sign-in. These providers process the information needed to provide those services and may process it in countries other than yours. The tadgobble team also uses a local workspace to review listings and prepare website previews.</p><p>We may disclose information when required by law or when reasonably necessary to investigate abuse and protect the service or its users. Opening a listed product takes you to another service with its own privacy policy.</p></section>
    <section><h2>Browser storage and security</h2><p>Your browser stores your sign-in session so you can stay signed in, a random visitor identifier for basic usage counts, and temporary navigation or interface preferences. Signing out clears the active local sign-in session. Clearing browser storage removes locally stored information but does not delete your account.</p><p>We use HTTPS, restricted database access, and account-based permissions. Only approved listings are made public. Do not send passwords, access tokens, payment details, or other sensitive secrets through a submission or contact message.</p></section>
    <section><h2>Keeping and deleting information</h2><p>Account information is kept while your account exists. To delete a member account, sign in, open your account menu, and choose Delete my account. This removes the login, saves, and comments, and disconnects any retained listings from the account.</p><p>Raw activity records are scheduled for deletion after 90 days; cleanup delays can extend that period. Messages and moderation records are kept as needed to handle requests, maintain the service, and address misuse. Backups and provider security logs may persist beyond removal from the active application.</p><p>You can use the form below to ask for access, correction, or deletion of your information, or for help if you cannot sign in. Tell us what you need without including sensitive documents or credentials.</p></section>
    <section><h2>Policy updates</h2><p>We will update this page when our practices change and revise the date above. Material changes will be explained through the service.</p></section>
  </LegalLayout>;
}

export function TermsPage() {
  return <LegalLayout type="terms" title="Terms of service." intro="Useful finds. Decent humans. These are the ground rules for being part of tadgobble.">
    <section><h2>Using tadgobble</h2><p>tadgobble is a community for discovering and sharing apps, tools, and other products. These terms apply when you use the website or create an account. Our <a href="/privacy">Privacy policy</a> explains how we handle information.</p></section>
    <section><h2>Your account</h2><p>Use an account you are authorized to use and keep your sign-in details secure. You are responsible for content and activity you submit through your account. Do not impersonate another person or attempt to access someone else’s account. Contact us if you believe your account has been misused.</p></section>
    <section><h2>Sharing something you made</h2><p>Submit a product only if you are its maker or have permission to submit it. You must have the rights to the descriptions, images, and other material you provide. Keep product claims, pricing information, and links accurate, and tell us when something needs correcting.</p><p>You keep ownership of your material. By submitting it, you give tadgobble permission to store, format, review, and display it as part of your listing and the discovery experience. Contact us to request a correction or removal.</p></section>
    <section><h2>Keep the community usable</h2><p>Do not post spam, fraudulent claims, malware, unlawful content, harassment, or material that violates another person’s rights. Do not disclose someone else’s private information, manipulate activity counts, bypass access controls, or interfere with the website.</p><p>We may decline, edit, or remove listings and comments, or restrict access when needed to address misuse or protect the community. You can contact us if you think a decision needs another look.</p></section>
    <section><h2>Reviews and paid features</h2><p>Submissions are reviewed before publication. Submission does not guarantee approval, placement, traffic, customers, or revenue. A review is not a guarantee of a product’s safety, quality, availability, or accuracy.</p><p>Paid features are labelled. Sending a partnership inquiry does not make a purchase or reserve a placement; any paid arrangement must be agreed separately.</p></section>
    <section><h2>The products you discover</h2><p>Listed products are operated by their own makers. Their prices, availability, privacy practices, purchases, support, and refunds are governed by their own terms. Check those details with the maker before using or buying a product. Tadgobble does not process purchases of listed products.</p></section>
    <section><h2>Availability and leaving</h2><p>Features and listings can change, and the service may experience interruptions. Keep your own copy of any material you submit. You can stop using tadgobble at any time and delete your member account from the account menu. Account deletion does not automatically remove every public listing; request listing or image removal through the form below.</p></section>
    <section><h2>Changes and questions</h2><p>We may update these terms as the service develops. We will update the date on this page and explain material changes through the service. Use the form below for questions, reports, or requests about these terms.</p></section>
  </LegalLayout>;
}
