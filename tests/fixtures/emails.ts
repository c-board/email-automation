import type { Classification } from "../../src/types/classification.types.js";

export type EmailFixture = {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  expectedClassification: Classification;
};

const receivedAt = "2026-10-06T15:00:00.000Z";

export const emailFixtures: EmailFixture[] = [
  {
    id: "pax8-application-confirmation",
    from: "pax8inc@myworkday.com",
    subject: "You're on our radar – thanks for applying to Pax8!",
    body: `Hi Alex,

Thanks for putting your hand up to join Pax8. We are genuinely excited to see your application land in our inbox.

Here is what happens next. We will review your application and aim to get back to you within 10 days.

If you are invited to interview, expect feedback within 48 hours.`,
    receivedAt,
    expectedClassification: "APPLICATION_CONFIRMATION",
  },
  {
    id: "linus-health-rejection",
    from: "Linus Health <no-reply@ats.rippling.com>",
    subject: "Thank you from Linus Health",
    body: `Hi Alex,

Thank you for taking the time to apply to the Senior Full Stack Engineer I (React, Node.JS) role here at Linus Health. Please note, we have received many applications for this role and the search has been very competitive. While we were impressed with your qualifications, it is unfortunate that we won't be proceeding with your application at this time.

We sincerely appreciate your interest and hope that you will stay in touch regarding future opportunities.

Thank you,
Linus Health`,
    receivedAt,
    expectedClassification: "REJECTION",
  },
  {
    id: "grainger-application-received",
    from: "Grainger Careers <noreply@grainger.com>",
    subject: "Grainger Application Received",
    body: `Dear Alex,

Thank you for your interest in joining our team. Your application has been received and is under review.

Talent Acquisition Team`,
    receivedAt,
    expectedClassification: "APPLICATION_CONFIRMATION",
  },
  {
    id: "grainger-employee-referral",
    from: "Grainger HR <donotreplyhr@grainger.com>",
    subject: "You have been referred to a job requisition at Jobs.Grainger",
    body: `Hello Alex,

This is an automated email to notify you that you have been submitted to a job via the Grainger Employee Referral Program. Use the link below to review the job and submit an application.

This message does not confirm that an application has been completed or received.

Thank you,
Talent Acquisition Team`,
    receivedAt,
    expectedClassification: "OTHER",
  },
  {
    id: "steris-interview-invitation",
    from: "STERIS Corporation <interviews@steris.example>",
    subject: "Interview Invitation || Alex Rivera - Senior Frontend Software Engineer - Cloud",
    body: `Hi Alex,

Great news! Your interview time is officially confirmed.
You are scheduled to interview for the Senior Frontend Software Engineer - Cloud position at STERIS.
When: Oct 9, 2026, 11:00 AM - 11:30 AM (America/Chicago)
Where: Video call

This interview will take place on video.`,
    receivedAt,
    expectedClassification: "INTERVIEW",
  },
  {
    id: "recruiter-contract-pitch",
    from: "Recruiting <recruiter@abhyanthsolutions.com>",
    subject: "AEM Tech Lead :: Fountain Valley, CA :: Long Term Contract",
    body: `Hi Alex,

I am reaching out regarding a contract AEM Tech Lead opportunity that may be a strong fit for your background.

Job Role: AEM Tech Lead
Location: Fountain Valley, CA
Duration: Long Term Contract

We are looking for a tech lead for a large AEM project. Please reply if you are interested.`,
    receivedAt,
    expectedClassification: "RECRUITER_OUTREACH",
  },
  {
    id: "toast-login-verification",
    from: "Toast Recruiting <noreply@toast.example>",
    subject: "Please verify your login at Toast Careers",
    body: `Hello Alex,

Here is the code required to complete your form on the Toast careers website.

EXAMPLE

This email was generated because of a form submitted on the Toast website. If this was not you, please ignore this email.`,
    receivedAt,
    expectedClassification: "OTHER",
  },
  {
    id: "recruiter-no-update",
    from: "Senior Recruiter <recruiter@180engineering.com>",
    subject: "Re: Your updated resume for the STERIS Senior Front-End Software Engineer role",
    body: `Alex,

As of right now we do not have an update, but we should hear back on first steps in the next few days.

Senior Recruiter
180 Engineering`,
    receivedAt,
    expectedClassification: "STATUS_UPDATE",
  },
  {
    id: "grainger-rejection",
    from: "Grainger Careers <noreply@grainger.com>",
    subject: "Update on your Grainger application",
    body: `Dear Alex,

Thank you for your interest in Grainger. After reviewing your application, we will not be moving forward with your candidacy.

Talent Acquisition Team`,
    receivedAt,
    expectedClassification: "REJECTION",
  },
  {
    id: "recruiter-client-submission",
    from: "Recruiter <recruiter@example-staffing.com>",
    subject: "I submitted your profile to Northwind",
    body: `Hi Alex,

I submitted your resume to my client Northwind for their backend role. You did not apply on the company site, and I have not heard back yet.

I will let you know if they want to talk.`,
    receivedAt,
    expectedClassification: "RECRUITER_OUTREACH",
  },
  {
    id: "incomplete-application-reminder",
    from: "Northwind Careers <noreply@northwind.example>",
    subject: "Your Northwind application is incomplete",
    body: `Hi Alex,

You started an application for Software Engineer at Northwind, but it has not been submitted. Please return and complete the remaining questions before the deadline.

This message does not confirm that an application was received.`,
    receivedAt,
    expectedClassification: "OTHER",
  },
  {
    id: "coding-assessment",
    from: "Northwind Hiring <hiring@northwind.example>",
    subject: "Coding assessment for Software Engineer",
    body: `Hi Alex,

The next step for the Software Engineer role at Northwind is a timed coding assessment. Please complete it within five days.

This is an evaluation request.`,
    receivedAt,
    expectedClassification: "ASSESSMENT",
  },
  {
    id: "job-offer",
    from: "Northwind Hiring <hiring@northwind.example>",
    subject: "Offer of employment - Software Engineer",
    body: `Hi Alex,

We are pleased to offer you the Software Engineer position at Northwind. This offer is contingent on a background check. Please reply to accept or decline by Friday.`,
    receivedAt,
    expectedClassification: "OFFER",
  },
  {
    id: "marketing-job-alert",
    from: "Job Alerts <alerts@jobboard.example>",
    subject: "12 new jobs match your search",
    body: `Hi Alex,

Here are new job alerts based on your saved search for frontend engineer. These are recommendations, not applications you submitted.

Unsubscribe from these alerts at any time.`,
    receivedAt,
    expectedClassification: "OTHER",
  },
  {
    id: "ambiguous-follow-up",
    from: "Sam Lee <sam@example.com>",
    subject: "Following up",
    body: `Hi Alex,

Just circling back on our conversation. Let me know when you have a chance to talk.

Thanks,
Sam`,
    receivedAt,
    expectedClassification: "UNKNOWN",
  },
];
