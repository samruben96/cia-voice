# Voice Agent Updates - January 7, 2026

This document details all changes made to the Chrysalis Insurance Agency voice agent (Iris) to enhance call handling capabilities.

---

## Table of Contents

1. [EZLynx Webhook Integration](#1-ezlynx-webhook-integration)
2. [Enhanced Quote Flow](#2-enhanced-quote-flow)
3. [Call Routing & Warm Transfers](#3-call-routing--warm-transfers)
4. [Claims Flow](#4-claims-flow)
5. [After-Hours Handling](#5-after-hours-handling)
6. [File Changes Summary](#file-changes-summary)
7. [Environment Variables](#environment-variables)
8. [New Tools Reference](#new-tools-reference)

---

## 1. EZLynx Webhook Integration

### Overview

Prepared the agent to integrate with EZLynx CRM via webhook. The integration is structured but not yet live (credentials pending).

### Data Flow

**SEND to EZLynx:**
- Caller phone number
- Caller name (if provided)
- Address/ZIP (if provided)

**RECEIVE from EZLynx:**
- Customer record (name, policies, carrier, policy numbers)
- Preferred agent
- Priority status

### New Files Created

#### `src/ezlynx/types.ts`

Defines TypeScript interfaces for webhook communication:

```typescript
// Request sent to EZLynx
interface EZLynxLookupRequest {
  phoneNumber: string;
  callerName?: string;
  address?: string;
  zipCode?: string;
  timestamp: string;
  sessionId: string;
}

// Policy information returned
interface EZLynxPolicy {
  policyNumber: string;
  policyType: 'auto' | 'home' | 'business' | 'life' | 'renters' | 'flood' | 'specialty' | 'other';
  carrier: string;
  effectiveDate: string;
  expirationDate: string;
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  premium?: number;
  premiumFrequency?: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
}

// Customer record returned
interface EZLynxCustomerRecord {
  found: boolean;
  customerId?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: { street, city, state, zipCode };
  policies?: EZLynxPolicy[];
  preferredAgent?: 'Eric' | 'Cherry' | 'Bryce' | 'Glen' | 'Melissa' | 'Riley';
  isPriority?: boolean;
}
```

#### `src/ezlynx/config.ts`

Configuration management with environment variable loading:

```typescript
interface EZLynxConfig {
  webhookUrl: string;      // EZLYNX_WEBHOOK_URL
  apiKey?: string;         // EZLYNX_API_KEY
  timeoutMs: number;       // EZLYNX_TIMEOUT_MS (default: 5000)
  enabled: boolean;        // EZLYNX_ENABLED
  useMockData: boolean;    // EZLYNX_USE_MOCK
}
```

#### `src/ezlynx/service.ts`

Webhook service with placeholder implementation:

- `isEnabled()` - Check if integration is configured
- `lookupCustomer(request)` - Perform customer lookup
- Mock data support for testing (enable with `EZLYNX_USE_MOCK=true`)
- Placeholder for actual webhook calls (commented code ready for implementation)

#### `src/ezlynx/index.ts`

Module exports for clean imports.

### New Tool: `lookupCustomer`

```typescript
lookupCustomer: {
  description: "Look up customer in CRM by phone number",
  parameters: {
    phoneNumber: string,  // Caller's phone number
    callerName?: string   // Name if already provided
  },
  returns: {
    found: boolean,
    customerName?: string,
    firstName?: string,
    preferredAgent?: string,
    isPriority?: boolean,
    policyCount?: number,
    policySummary?: string
  }
}
```

---

## 2. Enhanced Quote Flow

### New Proactive Quote Gathering Process

The agent now follows a structured flow when handling quote requests:

#### Step 1: Check Readiness
> "Wonderful! We'd love to help you with that. Do you have all your info handy now, or would you prefer one of our agents to follow up with you?"

#### Step 2: Gather Information (if ready)
- Insurance type: "What type of insurance are you looking for today?"
- Vehicle info (for auto): "Can you tell me the year, make, and model of your vehicle?"
- Address: "And what's your address so we can get accurate rates for your area?"
- Driver count (for auto): "How many drivers will be on the policy?"

#### Step 3: Channel Preference
> "Would you like to give me that information now over the phone, or would you prefer if I texted you a quick form to fill out?"

#### Step 4: Cross-Sell Opportunity
> "Are you just looking for auto insurance, or do you also need home or renters coverage? We can bundle those together for some nice discounts."

If interested:
> "Do you own or rent your home?"

#### Step 5: Confirm Contact
> "Is the number you're calling from the best way to reach you?"

### New Tool: `captureQuoteRequest`

```typescript
captureQuoteRequest: {
  description: "Capture complete quote request with all gathered information",
  parameters: {
    callerName: string,
    phoneNumber: string,
    email?: string,
    insuranceTypes: ('auto' | 'home' | 'renters' | 'business' | 'life' | 'flood' | 'specialty')[],
    vehicleInfo?: string,      // "2022 Honda Accord"
    address?: string,
    driverCount?: number,
    ownsHome?: boolean,
    preferredChannel: 'phone' | 'text' | 'email',
    bundleInterest: boolean,
    callbackPreferred: boolean,
    callbackTime?: string,
    notes?: string
  }
}
```

### Data Structure: `QuoteRequest`

```typescript
interface QuoteRequest {
  timestamp: string;
  callerName: string;
  phoneNumber: string;
  email?: string;
  insuranceTypes: string[];
  vehicleInfo?: string;
  address?: string;
  driverCount?: number;
  ownsHome?: boolean;
  preferredChannel: 'phone' | 'text' | 'email';
  bundleInterest: boolean;
  callbackPreferred: boolean;
  callbackTime?: string;
  notes?: string;
}
```

---

## 3. Call Routing & Warm Transfers

### Team Configuration

```typescript
const TEAM_MEMBERS = {
  // Service/Quotes Team (first priority for general calls)
  Melissa: { role: 'service_quotes', canHandleQuotes: true, canHandleClaims: true, isAgent: false },
  Riley:   { role: 'service_quotes', canHandleQuotes: true, canHandleClaims: true, isAgent: false },
  Cherry:  { role: 'service_quotes', canHandleQuotes: true, canHandleClaims: true, isAgent: true },

  // Licensed Agents
  Bryce: { role: 'agent', canHandleQuotes: true, canHandleClaims: true, isAgent: true },
  Glen:  { role: 'agent', canHandleQuotes: true, canHandleClaims: true, isAgent: true },

  // President (last resort only)
  Eric: { role: 'president', canHandleQuotes: true, canHandleClaims: true, isAgent: true, isLastResort: true },
};
```

### Routing Priority

1. **General service/quotes:** Melissa → Riley → Cherry
2. **Agent-specific matters:** Bryce, Glen
3. **Eric (President):** Only if specifically requested or as absolute last resort

### Warm Transfer Process

When transferring, the receiving team member hears:
> "I have [Caller Name] on the line. They're [an existing client / a new caller] asking about [reason for call]."

### New Tool: `checkAgentAvailability`

```typescript
checkAgentAvailability: {
  description: "Check if team member is available for transfer",
  parameters: {
    agentName: 'Melissa' | 'Riley' | 'Cherry' | 'Bryce' | 'Glen' | 'Eric'
  },
  returns: {
    agentName: string,
    available: boolean,
    message: string
  }
}
```

### New Tool: `warmTransfer`

```typescript
warmTransfer: {
  description: "Perform warm transfer with full context",
  parameters: {
    targetAgent: 'Melissa' | 'Riley' | 'Cherry' | 'Bryce' | 'Glen' | 'Eric',
    callerName: string,
    isExistingClient: boolean,
    reason: string,
    additionalContext?: string  // Policy numbers, urgency, etc.
  },
  returns: {
    success: boolean,
    targetAgent: string,
    announcement: string,  // What the agent hears
    message: string        // What to tell caller
  }
}
```

### New Tool: `takeMessage`

```typescript
takeMessage: {
  description: "Record message when agent is unavailable",
  parameters: {
    callerName: string,
    phoneNumber: string,
    forAgent?: 'Melissa' | 'Riley' | 'Cherry' | 'Bryce' | 'Glen' | 'Eric',
    message: string,
    urgency: 'low' | 'medium' | 'high',
    preferredCallbackTime?: string,
    reason: 'quote' | 'policy_service' | 'claim' | 'billing' | 'general'
  }
}
```

### If Agent Unavailable

> "It looks like [Name] is currently with another client. Would you like me to have them call you back? What's the best number and time to reach you?"

---

## 4. Claims Flow

### Enhanced Claims Handling Process

#### Step 1: Express Empathy First
> "I'm so sorry to hear that. Let me make sure we get you the help you need."

#### Step 2: Screen Preference
> "Are you looking to file the claim right now, or would you prefer to speak with one of our agents first to discuss your options?"

#### Step 3: Based on Answer

**If wants to speak with agent:**
- Use `warmTransfer` to connect them
- Or use `takeMessage` if unavailable

**If wants to file now:**
> "I can transfer you directly to your carrier's claims line, or one of our agents can call you back to walk you through it. Which would you prefer?"

#### Step 4: After-Hours Claims
> "Our agents are in at 8 AM on [next business day]. I can have one of them call you first thing, or I can transfer you to your carrier's 24-hour claims line right now. Which would you prefer?"

### New Tool: `recordClaimInquiry`

```typescript
recordClaimInquiry: {
  description: "Record claim inquiry with handling preference",
  parameters: {
    callerName: string,
    phoneNumber: string,
    claimType?: string,        // "auto accident", "property damage", etc.
    description?: string,       // What happened
    policyNumber?: string,
    preferredHandling: 'speak_agent' | 'file_now' | 'carrier_transfer' | 'callback',
    dateOfIncident?: string
  },
  returns: string  // Appropriate response based on preferredHandling
}
```

### Response Messages by Handling Type

| Preference | Response |
|------------|----------|
| `speak_agent` | "I have your information recorded. Let me connect you with an agent." |
| `file_now` | "Got it. Let me transfer you to your carrier to file the claim now." |
| `carrier_transfer` | "Connecting you to your carrier's claims line now." |
| `callback` | "I have all your information. An agent will call you back shortly to help with your claim." |

---

## 5. After-Hours Handling

### Office Hours

- **Monday - Friday:** 9:00 AM to 5:00 PM Pacific Time
- **Saturday - Sunday:** Closed

### Enhanced `checkOfficeHours` Tool

Now includes `nextBusinessDay` calculation:

```typescript
checkOfficeHours: {
  returns: {
    isOpen: boolean,
    currentTime: string,      // "3:45 PM"
    currentDay: string,       // "Tuesday"
    nextBusinessDay: string,  // "tomorrow" or "Monday"
    message: string
  }
}
```

### After-Hours Script

#### Initial Message
> "Thanks for calling Chrysalis Insurance Agency! Our office is currently closed. Our hours are Monday through Friday, 9 AM to 5 PM Pacific Time."

#### For Claims
> "If this is regarding a claim, I can transfer you to your carrier's 24-hour claims line, or I can have one of our agents call you back when we open at 8 AM [next business day]. Which would you prefer?"

#### For Quotes/General
> "I'd be happy to take a message and have someone call you back on the next business day. Can I get your name and the best number to reach you? And what time works best for a callback?"

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `src/ezlynx/types.ts` | TypeScript interfaces for EZLynx webhook |
| `src/ezlynx/config.ts` | Configuration management |
| `src/ezlynx/service.ts` | Webhook service with placeholder |
| `src/ezlynx/index.ts` | Module exports |

### Modified Files

| File | Changes |
|------|---------|
| `src/agent.ts` | Added new tools, enhanced instructions, team config |
| `.env.example` | Added EZLynx environment variables |

### Code Statistics

- **Lines added to agent.ts:** ~650 new lines
- **New tools added:** 7 (`lookupCustomer`, `captureQuoteRequest`, `checkAgentAvailability`, `warmTransfer`, `takeMessage`, `recordClaimInquiry`, enhanced `checkOfficeHours`)
- **New data structures:** 3 (`QuoteRequest`, `MessageRequest`, enhanced `CallNote`)

---

## Environment Variables

### New Variables (add to `.env.local`)

```bash
# EZLynx CRM Integration (credentials pending)
# Set EZLYNX_ENABLED=true when ready to enable the integration
EZLYNX_ENABLED=false
EZLYNX_WEBHOOK_URL=
EZLYNX_API_KEY=
EZLYNX_TIMEOUT_MS=5000

# Set to true to use mock data for development/testing
EZLYNX_USE_MOCK=false
```

### Existing Variables (unchanged)

```bash
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

---

## New Tools Reference

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `lookupCustomer` | Look up caller in CRM | Early in call when phone number available |
| `captureQuoteRequest` | Save complete quote request | After gathering all quote information |
| `checkAgentAvailability` | Check if team member can take call | Before attempting transfer |
| `warmTransfer` | Transfer with full context | When connecting to team member |
| `takeMessage` | Record message for callback | When agent unavailable |
| `recordClaimInquiry` | Record claim details | When caller has a claim |
| `checkOfficeHours` | Check if office is open | Start of call or when discussing availability |
| `captureCallNotes` | General call notes | Legacy, still supported |
| `endCall` | Conclude conversation | When call is ending |

---

## Testing

### Verify Build

```bash
pnpm run typecheck  # TypeScript check
pnpm run lint       # ESLint
pnpm run build      # Full build
```

### Test with Mock Data

Set `EZLYNX_USE_MOCK=true` in `.env.local` to test customer lookup with mock data.

Mock customer available: `+17145551234` (John Smith with auto and home policies)

### Run Development Server

```bash
pnpm run dev
```

---

## Next Steps

1. **EZLynx Integration:** When credentials are provided, update `EZLYNX_WEBHOOK_URL` and `EZLYNX_API_KEY`, set `EZLYNX_ENABLED=true`

2. **Real Availability System:** Replace the random availability check in `checkAgentAvailability` with actual phone system/calendar integration

3. **Carrier Transfer:** Implement actual SIP transfer to carrier 24-hour claims lines

4. **Persistent Storage:** Connect `callNotes`, `quoteRequests`, and `messageRequests` arrays to a database or CRM

5. **SMS Forms:** Implement the "text you a form" option in quote flow
