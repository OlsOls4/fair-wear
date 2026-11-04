/** General preparation guidance, verified against the linked official sources on 4 November 2026.
 * No scheme deadline, entitlement or outcome is inferred for an individual case.
 */
export const RENTER_GUIDANCE = {
  heading: "Before you send your response",
  scope: "Deposit procedures differ across the UK. Check the guidance for the property's location and the scheme protecting your deposit.",
  steps: [
    "Check your scheme's process and deadlines promptly. Preparing this bundle does not raise a dispute or extend a deadline.",
    "Keep your original photos and relevant records separately: the tenancy agreement, check-in and check-out reports, repair messages, and itemised invoices or quotes. This bundle does not attach those documents automatically.",
    "Label evidence by deduction and date, explain what each record shows, and include only relevant material. Review your draft and personal information before sharing; follow your scheme's instructions for submitting evidence.",
  ],
  links: [
    { label: "England: GOV.UK deposit disputes", href: "https://www.gov.uk/tenancy-deposit-protection/disputes-and-problems" },
    { label: "Wales: GOV.WALES deposit guidance", href: "https://www.gov.wales/deposits-guidance-tenants" },
    { label: "Scotland: mygov.scot deposit returns", href: "https://www.mygov.scot/tenant-deposits/get-deposit-back" },
    { label: "Northern Ireland: nidirect deposit schemes", href: "https://www.nidirect.gov.uk/articles/tenancy-deposit-scheme-information-tenants" },
    { label: "mydeposits: preparing relevant evidence", href: "https://www.mydeposits.co.uk/content-hub/evidence-for-deposit-dispute/" },
    { label: "DPS: fair wear, tear and betterment", href: "https://www.depositprotection.com/learning-centre/disputes/in-disputes-be-fair" },
  ],
} as const;
