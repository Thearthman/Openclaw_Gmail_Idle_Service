# Email Priority Configuration

Edit this file to describe what you consider urgent or important. The agent reads this file during silent evaluation before deciding whether to notify you.

Common urgent override rules are built into the notifier prompt: overdue/today/tomorrow/within-48-hour deadlines, urgent admin action, interview, offer, acceptance, rejection, approval, contract, payment/fee deadline, account lock, security issue, or emergency.

## P1 - Immediate

immediate:
  trigger_keywords:
    - approval
    - acceptance
    - rejection
    - invitation
    - contract
    - offer
    - termination
    - resignation
    - emergency
  auto_whitelist:
    senders: []
  note: "Notify immediately with why it matters and the recommended next action."

## P2 - High

high:
  trigger_keywords:
    - deadline
    - submission
    - payment
    - fee
    - urgent
    - refund
    - overdue
    - due
  trigger_subject_patterns:
    - "^Fwd:"
    - "\\[important\\]"
    - "\\[urgent\\]"
    - "\\[deadline\\]"
  auto_whitelist:
    senders: []
  note: "Notify with a concise summary and action suggestion."

## P3 - Medium

medium:
  trigger_keywords:
    - update
    - reminder
    - announcement
    - event
    - meeting
    - schedule
    - registration
    - enrollment
  trigger_subject_patterns:
    - "\\[update\\]"
    - "\\[notice\\]"
  auto_whitelist:
    senders: []
  note: "Usually buffer a short summary instead of interrupting."

## P4 - Low

low:
  trigger_keywords:
    - notice
    - general
    - info
    - progress
    - report
    - log
  trigger_subject_patterns:
    - "\\[report\\]"
    - "\\[system\\]"
    - "your account"
  auto_whitelist:
    senders: []
  note: "Stay silent unless the user asks for a summary."
