'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 rounded-2xl border p-5"
      style={{ background: 'rgba(255,59,48,0.07)', borderColor: 'rgba(255,59,48,0.25)' }}>
      {children}
    </div>
  )
}

function S({ n, title }: { n: string; title: string }) {
  return (
    <h2 className="font-bold text-white text-lg mt-12 mb-4 pt-6 border-t"
      style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
      {n}. {title}
    </h2>
  )
}

function Sub({ n, title }: { n: string; title: string }) {
  return (
    <h3 className="font-semibold mt-6 mb-2" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
      {n} {title}
    </h3>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.62)' }}>
      {children}
    </p>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>
      {children}
    </li>
  )
}

function Caps({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold leading-relaxed mb-3 tracking-wide"
      style={{ color: 'rgba(255,255,255,0.75)' }}>
      {children}
    </p>
  )
}

export default function TermsPage() {
  const router = useRouter()
  return (
    <div style={{ background: '#080808', minHeight: '100vh' }}>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b flex items-center justify-between px-5 py-3"
        style={{ background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(12px)', borderColor: 'rgba(255,255,255,0.07)' }}>
        <button type="button" onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-medium"
          style={{ color: 'rgba(255,255,255,0.5)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <span className="text-sm font-semibold text-white">Terms of Service</span>
        <Link href="/privacy" className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Privacy →
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-5 pb-36 pt-10">

        {/* Title block */}
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            Legal
          </p>
          <h1 className="font-bold text-white text-3xl mb-3">Terms of Service</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Effective Date: May 28, 2026 &nbsp;·&nbsp; Last Updated: May 28, 2026
          </p>
          <p className="text-sm mt-4 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Welcome to TripAlong. These Terms of Service (&quot;Terms&quot;) form a legally binding agreement
            between you and TripAlong (&quot;TripAlong,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;)
            governing your use of our mobile app, website at tripalong.app, and any related services
            (collectively, the &quot;Service&quot;). By creating an account or using the Service, you agree
            to these Terms. If you do not agree, do not use the Service.
          </p>
        </div>

        {/* ── 1 ── */}
        <S n="1" title="Acceptance and Scope" />
        <P>
          These Terms constitute a legally binding contract. By registering, clicking &quot;Agree,&quot; or
          otherwise accessing the Service, you confirm you have read and agree to be bound by these Terms
          and our <Link href="/privacy" className="underline" style={{ color: 'rgba(255,255,255,0.7)' }}>Privacy Policy</Link>,
          which is incorporated herein by reference.
        </P>
        <P>
          If you are using the Service on behalf of a company or other legal entity, you represent that
          you have authority to bind that entity to these Terms.
        </P>

        {/* ── 2 ── */}
        <S n="2" title="Changes to Terms" />
        <P>
          We may update these Terms at any time. For material changes, we will notify you by posting a
          notice in the app or sending an email. Your continued use of the Service after the effective date
          of the revised Terms constitutes your acceptance. If you disagree, you must stop using the
          Service and delete your account.
        </P>

        {/* ── 3 ── */}
        <S n="3" title="Eligibility" />
        <Sub n="3.1" title="Age Requirement." />
        <P>
          You must be at least <strong className="text-white">18 years of age</strong> to use TripAlong.
          By using the Service you represent and warrant that you are 18 or older. If we discover you are
          under 18 we will immediately terminate your account and delete your data.
        </P>
        <Sub n="3.2" title="Legal Capacity." />
        <P>
          You represent that you have the legal capacity to enter into a binding contract under applicable
          law and are not prohibited from receiving services under any applicable law or regulation.
        </P>
        <Sub n="3.3" title="Previously Banned Users." />
        <P>
          You may not create a new account if TripAlong has previously terminated your account for
          violations of these Terms.
        </P>

        {/* ── 4 ── */}
        <S n="4" title="Account Registration and Security" />
        <Sub n="4.1" title="Accurate Information." />
        <P>
          You agree to provide accurate, current, and complete information when registering and to keep it
          updated. Providing false information — including misrepresenting your age, identity, or location
          — is a violation of these Terms.
        </P>
        <Sub n="4.2" title="One Account Per Person." />
        <P>
          Each individual may maintain only one account. Creating multiple accounts may result in
          termination of all accounts.
        </P>
        <Sub n="4.3" title="Account Security." />
        <P>
          You are solely responsible for the security and confidentiality of your login credentials and
          for all activity under your account. Notify us immediately at{' '}
          <a href="mailto:legal@tripalong.app" className="underline" style={{ color: 'rgba(255,255,255,0.7)' }}>
            legal@tripalong.app
          </a>{' '}
          if you suspect unauthorized access. TripAlong is not liable for losses from unauthorized access
          that resulted from your failure to safeguard your credentials.
        </P>
        <Sub n="4.4" title="No Account Transfers." />
        <P>
          Your account is personal to you and may not be transferred, sold, or shared with any other person.
        </P>

        {/* ── 5 ── */}
        <S n="5" title="User Content" />
        <Sub n="5.1" title="Ownership." />
        <P>
          You retain ownership of content you post on TripAlong, including photos, profile text, trip
          details, and messages (&quot;User Content&quot;).
        </P>
        <Sub n="5.2" title="License Grant to TripAlong." />
        <P>
          By posting User Content, you grant TripAlong a worldwide, non-exclusive, royalty-free,
          sublicensable, and transferable license to use, reproduce, modify, adapt, distribute, publicly
          display, and perform your User Content solely in connection with operating, providing, and
          improving the Service. This license ends when you delete your content or account, subject to
          content already shared with other users.
        </P>
        <Sub n="5.3" title="Your Responsibility." />
        <P>
          You are solely and exclusively responsible for your User Content. You represent and warrant that:
          (a) you own or have sufficient rights to post the content; (b) the content does not violate these
          Terms, applicable law, or any third-party rights (including intellectual property, privacy, or
          defamation); and (c) the content is accurate and not misleading.
        </P>
        <Sub n="5.4" title="Content Moderation." />
        <P>
          We reserve the right — but not the obligation — to review, monitor, remove, or edit any User
          Content at any time and for any reason, without notice. We are not responsible for any failure
          to remove content.
        </P>

        {/* ── 6 ── */}
        <S n="6" title="Prohibited Conduct" />
        <P>You agree not to, and will not facilitate others to:</P>
        <ul className="list-disc ml-5 space-y-2 mb-4">
          <Li>Use the Service if you are under 18 years of age</Li>
          <Li>Impersonate any person or entity, or misrepresent your identity, age, or affiliations</Li>
          <Li>Post false, fraudulent, misleading, or deceptive content</Li>
          <Li>Harass, bully, intimidate, stalk, threaten, or harm any user or third party</Li>
          <Li>Post sexually explicit, violent, discriminatory, or otherwise objectionable material</Li>
          <Li>Solicit money, gifts, or personal information from other users under false pretenses</Li>
          <Li>Use the Service for any commercial, advertising, or promotional purpose without our written consent</Li>
          <Li>Collect, harvest, or scrape personal data of other users without their explicit consent</Li>
          <Li>Transmit malware, spam, phishing content, or any disruptive code or data</Li>
          <Li>Attempt to access, probe, or test the security of TripAlong systems without authorization</Li>
          <Li>Use automated means (bots, scrapers, crawlers) to access the Service</Li>
          <Li>Interfere with the Service or its servers or networks</Li>
          <Li>Engage in any unlawful activity through or in connection with the Service</Li>
          <Li>Facilitate or enable any of the above</Li>
        </ul>
        <P>
          Violations may result in immediate termination of your account and, where appropriate,
          referral to law enforcement.
        </P>

        {/* ── 7 — MOST IMPORTANT ── */}
        <S n="7" title="Safety — In-Person Meetings and Travel" />
        <Warn>
          <p className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: 'rgba(255,80,70,0.9)' }}>
            ⚠ Important — Read This Section Carefully
          </p>
          <Caps>
            TRIPALONG IS AN ONLINE PLATFORM. WE DO NOT ORGANIZE, SUPERVISE, MONITOR,
            OR GUARANTEE ANY IN-PERSON MEETINGS, TRAVEL, OR OFFLINE INTERACTIONS MADE
            THROUGH THE SERVICE.
          </Caps>
        </Warn>
        <Sub n="7.1" title="No Identity or Background Verification." />
        <P>
          <strong className="text-white">TripAlong does not conduct criminal background checks, sex-offender
          registry checks, identity verification, or any other screening of its users.</strong> We cannot
          confirm that any user is who they claim to be. Users may provide false information about their
          identity, age, profession, travel history, intentions, or any other characteristic. You are
          solely responsible for conducting your own due diligence on any person you interact with.
        </P>
        <Sub n="7.2" title="Your Sole Responsibility." />
        <P>
          If you choose to meet another user in person, travel with another user, share accommodation with
          another user, or engage in any offline interaction as a result of connections made through
          TripAlong, you do so <strong className="text-white">entirely at your own risk.</strong> You are solely
          responsible for assessing the trustworthiness, safety, and suitability of any individual you interact
          with, online or offline.
        </P>
        <Sub n="7.3" title="Disclaimer of Liability for Offline Conduct." />
        <Caps>
          TRIPALONG EXPRESSLY DISCLAIMS ALL LIABILITY FOR ANY HARM, BODILY INJURY, DEATH,
          LOSS, THEFT, FRAUD, SEXUAL ASSAULT, HARASSMENT, STALKING, EMOTIONAL DISTRESS,
          OR ANY OTHER PHYSICAL, FINANCIAL, OR EMOTIONAL DAMAGE ARISING FROM: (A)
          IN-PERSON MEETINGS ARRANGED THROUGH THE SERVICE; (B) TRAVEL UNDERTAKEN WITH
          INDIVIDUALS MET THROUGH THE SERVICE; (C) ANY OFFLINE CONDUCT OF ANY USER; OR
          (D) YOUR FAILURE TO EXERCISE REASONABLE CAUTION IN MEETING STRANGERS.
        </Caps>
        <Sub n="7.4" title="International Travel Risks." />
        <P>
          Travel — especially international travel — carries inherent risks including but not limited to
          accidents, illness, political instability, natural disasters, crime, and legal exposure to
          foreign laws. TripAlong has no responsibility for your safety, health, legal status, or
          well-being while you are traveling, whether or not the travel was arranged through the Service.
          You are responsible for obtaining appropriate travel insurance, visas, vaccinations, and other
          preparations.
        </P>
        <Sub n="7.5" title="Safety Recommendations." />
        <P>We strongly encourage you to:</P>
        <ul className="list-disc ml-5 space-y-2 mb-4">
          <Li>Research anyone you plan to meet using independent sources</Li>
          <Li>Meet for the first time in public, well-populated places</Li>
          <Li>Inform a trusted friend or family member of your plans before meeting</Li>
          <Li>Arrange your own transportation to and from first meetings</Li>
          <Li>Trust your instincts — if something feels wrong, leave immediately</Li>
          <Li>Contact local emergency services (police, ambulance) if you are in immediate danger</Li>
        </ul>
        <P>
          These recommendations do not limit TripAlong&apos;s liability disclaimers above. Even if you
          follow all safety recommendations, TripAlong bears no responsibility for harm that results from
          in-person interactions.
        </P>

        {/* ── 8 ── */}
        <S n="8" title="Not a Travel Agency" />
        <P>
          TripAlong is a social networking and travel-matching platform. We are{' '}
          <strong className="text-white">not a travel agency, tour operator, transportation carrier,
          accommodation provider, travel insurance company, or any other travel service provider.</strong>
        </P>
        <P>
          We do not book, arrange, operate, endorse, or guarantee any travel service, accommodation,
          activity, transportation, or any other component of a trip. We have no control over and make no
          representations about the quality, safety, legality, or availability of any trip, destination,
          or travel-related service discussed on or arranged through the platform.
        </P>
        <P>
          TripAlong is not responsible for any trip cancellations, no-shows, disappointments, injuries,
          accidents, losses, or financial harm arising from travel plans made through the Service.
        </P>

        {/* ── 9 ── */}
        <S n="9" title="Privacy" />
        <P>
          Your use of the Service is governed by our{' '}
          <Link href="/privacy" className="underline" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Privacy Policy
          </Link>
          , which is incorporated into these Terms by this reference. Please review the Privacy Policy
          to understand our practices.
        </P>

        {/* ── 10 ── */}
        <S n="10" title="Third-Party Services and Links" />
        <P>
          The Service integrates with or links to third-party services, including Google Sign-In, mapping
          services, and cloud infrastructure. These third parties operate under their own terms and privacy
          policies. TripAlong does not endorse and is not responsible for the content, practices, or
          reliability of any third-party service. Your use of third-party services is at your own risk and
          subject to those parties&apos; terms.
        </P>

        {/* ── 11 ── */}
        <S n="11" title="Intellectual Property" />
        <Sub n="11.1" title="TripAlong's IP." />
        <P>
          The TripAlong name, logo, app, website, design, and all content and materials we create are
          owned by or licensed to TripAlong and protected by copyright, trademark, and other intellectual
          property laws. You may not use our trademarks, trade names, service marks, or proprietary
          content without our prior written consent.
        </P>
        <Sub n="11.2" title="DMCA Notice." />
        <P>
          We respect intellectual property rights. If you believe content on TripAlong infringes your
          copyright, send a DMCA notice to{' '}
          <a href="mailto:legal@tripalong.app" className="underline" style={{ color: 'rgba(255,255,255,0.7)' }}>
            legal@tripalong.app
          </a>{' '}
          including: (a) identification of the work claimed to be infringed; (b) identification and
          location of the infringing material on our Service; (c) your contact information; (d) a
          statement of good faith belief that the use is not authorized; and (e) a statement, under
          penalty of perjury, that the information in the notice is accurate and you are authorized to
          act on behalf of the copyright owner.
        </P>

        {/* ── 12 ── */}
        <S n="12" title="Disclaimer of Warranties" />
        <Warn>
          <Caps>
            THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT
            WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE
            LAW, TRIPALONG DISCLAIMS ALL WARRANTIES, INCLUDING: IMPLIED WARRANTIES OF MERCHANTABILITY,
            FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT; WARRANTIES THAT THE SERVICE
            WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE; WARRANTIES REGARDING THE ACCURACY,
            RELIABILITY, OR COMPLETENESS OF ANY CONTENT; AND WARRANTIES REGARDING THE CONDUCT,
            IDENTITY, OR INTENTIONS OF ANY USER.
          </Caps>
          <Caps>
            YOU ASSUME FULL RESPONSIBILITY AND RISK FOR YOUR USE OF THE SERVICE. SOME JURISDICTIONS
            DO NOT ALLOW DISCLAIMER OF CERTAIN WARRANTIES; IN SUCH CASES, THE ABOVE DISCLAIMERS
            APPLY TO THE MAXIMUM EXTENT PERMITTED.
          </Caps>
        </Warn>

        {/* ── 13 ── */}
        <S n="13" title="Limitation of Liability" />
        <Warn>
          <Caps>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, TRIPALONG AND ITS OFFICERS,
            DIRECTORS, EMPLOYEES, AGENTS, PARTNERS, AND LICENSORS SHALL NOT BE LIABLE FOR ANY
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES OF ANY
            KIND, INCLUDING BUT NOT LIMITED TO: LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR
            ANTICIPATED SAVINGS; PERSONAL INJURY OR DEATH; PROPERTY DAMAGE; COST OF SUBSTITUTE
            SERVICES; OR ANY OTHER INTANGIBLE OR TANGIBLE LOSS — ARISING OUT OF OR RELATED TO
            YOUR USE OF OR INABILITY TO USE THE SERVICE, THE CONDUCT OF ANY OTHER USER, OR ANY
            IN-PERSON MEETING OR TRAVEL ARRANGEMENT, REGARDLESS OF THE LEGAL THEORY AND EVEN
            IF TRIPALONG HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </Caps>
          <Caps>
            IN NO EVENT SHALL TRIPALONG&apos;S TOTAL CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS
            ARISING OUT OF OR RELATED TO THESE TERMS OR YOUR USE OF THE SERVICE EXCEED THE GREATER
            OF: (A) THE TOTAL AMOUNT YOU PAID TO TRIPALONG IN THE TWELVE (12) MONTHS IMMEDIATELY
            PRECEDING THE EVENT GIVING RISE TO THE CLAIM; OR (B) ONE HUNDRED U.S. DOLLARS ($100.00).
          </Caps>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            These limitations reflect a reasonable allocation of risk and are an essential element of
            the basis of the bargain between you and TripAlong. Some jurisdictions do not permit
            exclusion of certain damages; in such jurisdictions the limitations above apply to the
            maximum extent permitted by law.
          </p>
        </Warn>

        {/* ── 14 ── */}
        <S n="14" title="Indemnification" />
        <P>
          You agree to defend, indemnify, and hold harmless TripAlong and its officers, directors,
          employees, agents, and successors from and against any and all claims, liabilities, damages,
          judgments, losses, costs, and expenses (including reasonable attorneys&apos; fees) arising out of
          or in any way connected with:
        </P>
        <ul className="list-disc ml-5 space-y-2 mb-4">
          <Li>Your access to or use of the Service</Li>
          <Li>Your User Content</Li>
          <Li>Your violation of these Terms or any applicable law</Li>
          <Li>Your violation of any third-party rights, including intellectual property or privacy rights</Li>
          <Li>Any in-person meeting, travel, or offline interaction you arrange through the Service</Li>
          <Li>Any misrepresentation you make to TripAlong or to other users</Li>
        </ul>
        <P>
          TripAlong reserves the right to assume exclusive control of any matter subject to
          indemnification by you, in which case you agree to cooperate with our defense.
        </P>

        {/* ── 15 — ARBITRATION ── */}
        <S n="15" title="Dispute Resolution — Binding Arbitration" />
        <Warn>
          <p className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: 'rgba(255,200,70,0.85)' }}>
            ⚖ Please Read Carefully — This Affects Your Legal Rights
          </p>
          <Caps>
            THIS SECTION REQUIRES YOU TO RESOLVE DISPUTES WITH TRIPALONG THROUGH BINDING
            INDIVIDUAL ARBITRATION RATHER THAN IN COURT, AND WAIVES YOUR RIGHT TO PARTICIPATE
            IN CLASS ACTION LAWSUITS. YOU HAVE THE RIGHT TO OPT OUT (SEE SECTION 15.6).
          </Caps>
        </Warn>
        <Sub n="15.1" title="Informal Resolution First." />
        <P>
          Before filing any claim against TripAlong, you agree to contact us at{' '}
          <a href="mailto:legal@tripalong.app" className="underline" style={{ color: 'rgba(255,255,255,0.7)' }}>
            legal@tripalong.app
          </a>{' '}
          and attempt to resolve the dispute informally. You must provide a written description of the
          dispute and your proposed resolution. If the dispute is not resolved within{' '}
          <strong className="text-white">30 days</strong> of your written notice, either party may
          initiate arbitration.
        </P>
        <Sub n="15.2" title="Binding Individual Arbitration." />
        <P>
          Except as provided in Section 15.3, you and TripAlong agree that any dispute, claim, or
          controversy arising out of or relating to these Terms, the Privacy Policy, or your use of
          the Service (&quot;Dispute&quot;) shall be resolved by{' '}
          <strong className="text-white">binding individual arbitration</strong>, rather than in court.
          Arbitration is administered by the{' '}
          <strong className="text-white">American Arbitration Association (&quot;AAA&quot;)</strong> under
          its Consumer Arbitration Rules (available at adr.org). The arbitration will be conducted in
          English. The arbitrator&apos;s decision is final and binding, and judgment may be entered in any
          court of competent jurisdiction.
        </P>
        <Sub n="15.3" title="Exceptions to Arbitration." />
        <P>Either party may:</P>
        <ul className="list-disc ml-5 space-y-2 mb-4">
          <Li>Bring an individual claim in small claims court if it qualifies</Li>
          <Li>Seek emergency injunctive or other equitable relief from a court of competent jurisdiction to prevent irreparable harm pending arbitration</Li>
          <Li>Report violations of law to the relevant government authority</Li>
        </ul>
        <Sub n="15.4" title="Class Action and Representative Action Waiver." />
        <Caps>
          YOU AND TRIPALONG AGREE THAT EACH PARTY MAY BRING CLAIMS AGAINST THE OTHER ONLY
          IN AN INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY
          PURPORTED CLASS ACTION, COLLECTIVE ACTION, CONSOLIDATED ARBITRATION, PRIVATE
          ATTORNEY GENERAL ACTION, OR OTHER REPRESENTATIVE PROCEEDING. THE ARBITRATOR
          MAY NOT CONSOLIDATE MORE THAN ONE PERSON&apos;S CLAIMS AND MAY NOT PRESIDE OVER ANY
          FORM OF CLASS OR REPRESENTATIVE PROCEEDING. IF THIS CLASS-ACTION WAIVER IS FOUND
          UNENFORCEABLE, THE ARBITRATION AGREEMENT IN ITS ENTIRETY SHALL BE NULL AND VOID.
        </Caps>
        <Sub n="15.5" title="Jury Trial Waiver." />
        <P>
          To the extent permitted by applicable law, both you and TripAlong waive any right to a trial
          by jury for any Dispute covered by this Section 15.
        </P>
        <Sub n="15.6" title="30-Day Opt-Out Right." />
        <P>
          You may opt out of binding arbitration by sending written notice to{' '}
          <a href="mailto:legal@tripalong.app" className="underline" style={{ color: 'rgba(255,255,255,0.7)' }}>
            legal@tripalong.app
          </a>{' '}
          with subject line &quot;Arbitration Opt-Out&quot; within{' '}
          <strong className="text-white">30 days of first creating your TripAlong account</strong>. Your
          notice must include your name and registered email address. If you opt out, neither party may
          require the other to participate in arbitration for any Dispute. Opting out does not affect
          any other provision of these Terms.
        </P>

        {/* ── 16 ── */}
        <S n="16" title="Governing Law and Jurisdiction" />
        <P>
          These Terms and any Disputes arising hereunder shall be governed by the laws of the{' '}
          <strong className="text-white">State of California, United States</strong>, without regard to
          conflict of law principles. For any Dispute not subject to arbitration under Section 15, the
          parties consent to the exclusive personal jurisdiction of the state and federal courts located
          in <strong className="text-white">Los Angeles County, California</strong>.
        </P>

        {/* ── 17 ── */}
        <S n="17" title="Termination" />
        <Sub n="17.1" title="By You." />
        <P>
          You may terminate your account at any time by using the Delete Account option in Settings.
          Upon deletion, your profile will be removed and your data will be deleted in accordance with
          our Privacy Policy.
        </P>
        <Sub n="17.2" title="By TripAlong." />
        <P>
          We may suspend or permanently terminate your access to the Service at any time, with or without
          notice, for any reason, including if we believe in good faith that you have violated these
          Terms, endangered any user, or engaged in illegal activity. We are not liable to you or any
          third party for any termination of your account.
        </P>
        <Sub n="17.3" title="Survival." />
        <P>
          The following Sections survive termination of your account or these Terms: 5.2 (License
          Grant), 7 (Safety Disclaimer), 8 (Not a Travel Agency), 11 (IP), 12 (Warranty Disclaimer),
          13 (Limitation of Liability), 14 (Indemnification), 15 (Dispute Resolution), 16 (Governing
          Law), and 18 (General Provisions).
        </P>

        {/* ── 18 ── */}
        <S n="18" title="General Provisions" />
        <Sub n="18.1" title="Entire Agreement." />
        <P>
          These Terms and the Privacy Policy constitute the entire agreement between you and TripAlong
          regarding the Service and supersede all prior agreements, representations, and understandings.
        </P>
        <Sub n="18.2" title="Severability." />
        <P>
          If any provision of these Terms is held invalid or unenforceable by a court of competent
          jurisdiction, that provision shall be modified to the minimum extent necessary to make it
          enforceable, and the remaining provisions shall remain in full force and effect.
        </P>
        <Sub n="18.3" title="No Waiver." />
        <P>
          Our failure to enforce any right or provision of these Terms shall not constitute a waiver of
          that right or provision.
        </P>
        <Sub n="18.4" title="Assignment." />
        <P>
          You may not assign or transfer these Terms or your account without TripAlong&apos;s prior written
          consent. TripAlong may freely assign these Terms, including in connection with a merger,
          acquisition, or sale of assets.
        </P>
        <Sub n="18.5" title="Force Majeure." />
        <P>
          TripAlong shall not be liable for any failure or delay in performance caused by circumstances
          beyond our reasonable control, including acts of God, natural disasters, war, terrorism,
          government action, pandemics, or internet or infrastructure outages.
        </P>
        <Sub n="18.6" title="Feedback." />
        <P>
          If you provide us with feedback, suggestions, or ideas about the Service, you grant us an
          unlimited, perpetual, royalty-free license to use that feedback without compensation or
          attribution to you.
        </P>

        {/* ── 19 ── */}
        <S n="19" title="Contact Us" />
        <P>For questions about these Terms, please contact us:</P>
        <div className="rounded-2xl p-5 mt-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-sm font-semibold text-white mb-1">TripAlong</p>
          <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Legal inquiries:{' '}
            <a href="mailto:legal@tripalong.app" className="underline" style={{ color: 'rgba(255,255,255,0.75)' }}>
              legal@tripalong.app
            </a>
          </p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            General support:{' '}
            <a href="mailto:support@tripalong.app" className="underline" style={{ color: 'rgba(255,255,255,0.75)' }}>
              support@tripalong.app
            </a>
          </p>
        </div>

        {/* Footer links */}
        <div className="flex items-center gap-5 mt-16 pt-8 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <Link href="/privacy" className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Privacy Policy →
          </Link>
        </div>
      </main>
    </div>
  )
}
