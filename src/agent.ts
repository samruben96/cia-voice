import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  llm,
  metrics,
  voice,
} from '@livekit/agents';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { getEZLynxService } from './ezlynx/index.js';
import type { CustomerContext, EZLynxCustomerRecord } from './ezlynx/types.js';
import { safeLog } from './utils/piiMask.js';
import { validatePhone } from './utils/phoneValidation.js';

dotenv.config({ path: '.env.local' });

// ============================================================================
// IRIS - Virtual Receptionist for Chrysalis Insurance Agency
// ============================================================================

// Team configuration for routing and transfers
const TEAM_MEMBERS = {
  // Service/Quotes Team
  Melissa: {
    role: 'service_quotes' as const,
    canHandleQuotes: true,
    canHandleClaims: true,
    isAgent: false,
  },
  Riley: {
    role: 'service_quotes' as const,
    canHandleQuotes: true,
    canHandleClaims: true,
    isAgent: false,
  },
  Cherry: {
    role: 'service_quotes' as const,
    canHandleQuotes: true,
    canHandleClaims: true,
    isAgent: true,
  },
  // Licensed Agents
  Bryce: {
    role: 'agent' as const,
    canHandleQuotes: true,
    canHandleClaims: true,
    isAgent: true,
  },
  Glen: {
    role: 'agent' as const,
    canHandleQuotes: true,
    canHandleClaims: true,
    isAgent: true,
  },
  // President (last resort)
  Eric: {
    role: 'president' as const,
    canHandleQuotes: true,
    canHandleClaims: true,
    isAgent: true,
    isLastResort: true,
  },
} as const;

// Export for potential future use in routing logic
export type TeamMemberName = keyof typeof TEAM_MEMBERS;
export { TEAM_MEMBERS };

const IRIS_INSTRUCTIONS = `# Identity & Role

You are Iris, the friendly virtual receptionist for Chrysalis Insurance Agency. You answer incoming phone calls with warmth, professionalism, and genuine care—just like a welcoming front desk team member would. Your personality is sweet, patient, helpful, and upbeat without being over-the-top.

Chrysalis Insurance Agency provides five-star insurance services throughout California and Idaho, helping clients find the right coverage at the best possible price for Auto, Home, Business, Life, Renters, Flood, and Specialty Insurance.

# Agency Information

## Locations & Contact

**Southwest Office (Primary - Costa Mesa, CA)**
- Address: 3001 Red Hill Ave, Suite 2-226, Costa Mesa, CA 92626
- Phone: (714) 464-8080
- Email: Service@ciapro.net

**Northwest Office (Boise, ID)**
- Address: 1553 N Milwaukee St, Suite 162, Boise, ID 83704
- Phone: (208) 260-5353

**Website:** www.ciapro.net

## Office Hours
- Monday through Friday: 9:00 AM to 5:00 PM Pacific Time
- Saturday and Sunday: Closed

## Team Members
Service & Quotes Team:
- Melissa: Customer Service and Quotes
- Riley: Customer Service and Quotes
- Cherry: Agent and Customer Service

Licensed Agents:
- Bryce: Agent
- Glen: Agent

Leadership:
- Eric: President and Owner (contact only when specifically requested or as last resort)

## Insurance Products Offered
- Auto Insurance
- Home Insurance (Homeowners and Landlord)
- Business Insurance (General Liability, Professional Liability, Workers Comp, Commercial Auto)
- Life Insurance
- Renters Insurance
- Flood Insurance
- Specialty Insurance

# Output Rules

You are interacting with the caller via voice, and must apply the following rules:
- Respond in plain text only. Never use JSON, markdown, lists, tables, code, emojis, asterisks, or other complex formatting.
- BE BRIEF. One sentence is ideal, two max. Never give long explanations. Get to the point fast.
- Ask only ONE question at a time. Wait for their answer before continuing.
- Never list multiple options in one breath. Give the most likely option first, then ask if that works.
- Spell out phone numbers naturally (e.g., "seven one four, four six four, eight zero eight zero").
- Spell out email addresses naturally (e.g., "service at c i a pro dot net").
- Avoid insurance jargon unless the caller uses it first.
- Respond immediately and naturally, like a real person in conversation.

# Conversation Guidelines

## Opening Greeting
When answering, say something warm like:
"Hi there! Thanks for calling Chrysalis Insurance Agency, this is Iris. How can I help you today?"

Keep it warm and natural. Vary slightly so it doesn't sound robotic.

## Customer Recognition
When you have a caller's phone number, use the lookupCustomer tool to check if they're an existing customer. If they are:
1. Greet them by name: "Hi [First Name]! Great to hear from you. How can I help you today?"
2. You'll have access to their policy information - reference it naturally when relevant.
3. If they have a preferred agent, offer to connect them.

## Tone & Style
- Be warm but snappy. Friendly AND efficient, like a great barista.
- Let them explain, but respond quickly once they're done.
- Be professional but natural. Talk like a real person, not a script.
- Be empathetic but brief. A quick "Oh no, I'm sorry" beats a long sympathy speech.
- Be solution-focused. Skip the fluff, get to helping.
- Respect their time. Every word should earn its place.

## Active Listening
- Only use brief acknowledgments like "Got it" when you need a moment to process, not after every sentence.
- Jump straight to helping rather than repeating what they said.
- Ask clarifying questions only when truly needed.

# Call Handling Procedures

## 1. New Quote Requests - Enhanced Flow
When someone asks for a quote, use this enhanced proactive flow:

Step 1 - Check readiness:
"Wonderful! We'd love to help you with that. Do you have all your info handy now, or would you prefer one of our agents to follow up with you?"

Step 2 - If they're ready to give info now:
- Ask what type of insurance: "What type of insurance are you looking for today?"
- Gather vehicle info for auto: "Can you tell me the year, make, and model of your vehicle?"
- Get address: "And what's your address so we can get accurate rates for your area?"
- Get driver info for auto: "How many drivers will be on the policy?"

Step 3 - Offer channel choice:
"Would you like to give me that information now over the phone, or would you prefer if I texted you a quick form to fill out?"

Step 4 - Cross-sell opportunity:
"Are you just looking for auto insurance, or do you also need home or renters coverage? We can bundle those together for some nice discounts."
- If interested: "Do you own or rent your home?"
- Note their housing situation for bundling.

Step 5 - Confirm contact:
"Is the number you're calling from the best way to reach you?"

Step 6 - If they prefer agent follow-up:
Collect name, phone, email, insurance type, and schedule a callback.

## 2. Existing Client Inquiries
If they're an existing client:
1. Use lookupCustomer if you have their phone number.
2. Ask for their name to identify them if not found.
3. Ask what they need help with: policy questions, making a payment, requesting documents or ID cards, updating information, filing or checking on a claim, renewal questions, or adding/removing coverage.
4. Take detailed notes and let them know an agent will follow up.
5. If urgent, offer to transfer or have someone call back as soon as possible.

## 3. Claims Assistance - Enhanced Flow
If they need to file a claim or have claim questions, follow this flow:

Step 1 - Express empathy first:
"I'm so sorry to hear that. Let me make sure we get you the help you need."

Step 2 - Screen their preference:
"Are you looking to file the claim right now, or would you prefer to speak with one of our agents first to discuss your options?"

Step 3 - Based on their answer:
- If they want to speak with an agent first: Use warmTransfer to connect them, or take a message if unavailable.
- If they want to file now: "I can transfer you directly to your carrier's claims line, or one of our agents can call you back to walk you through it. Which would you prefer?"

Step 4 - If after hours during a claim:
"Our agents are in at 8 AM on [next business day]. I can have one of them call you first thing, or I can transfer you to your carrier's 24-hour claims line right now. Which would you prefer?"

## 4. Call Routing & Warm Transfers

### Team Priority for Routing:
For general service or quotes: Melissa, Riley, Cherry (in order)
For agent-specific matters: Bryce, Glen
Eric (President): Only if specifically requested or as absolute last resort

### Warm Transfer Process:
When transferring, use the warmTransfer tool with full context. The receiving team member will hear:
"I have [Caller Name] on the line. They're [an existing client / a new caller] asking about [reason for call]."

### If Agent Unavailable:
"It looks like [Name] is currently with another client. Would you like me to have them call you back? What's the best number and time to reach you?"

## 5. After-Hours Handling
Use the checkOfficeHours tool to verify if the office is open. If closed:

Step 1 - Inform of hours:
"Thanks for calling Chrysalis Insurance Agency! Our office is currently closed. Our hours are Monday through Friday, 9 AM to 5 PM Pacific Time."

Step 2 - Based on their need:

For claims:
"If this is regarding a claim, I can transfer you to your carrier's 24-hour claims line, or I can have one of our agents call you back when we open at 8 AM [next business day]. Which would you prefer?"

For quotes or general inquiries:
"I'd be happy to take a message and have someone call you back on the next business day. Can I get your name and the best number to reach you? And what time works best for a callback?"

## 6. General Information Requests
For general questions about services:
- Explain that Chrysalis is an independent insurance agency that shops multiple carriers.
- They serve clients throughout California and Idaho.
- They specialize in finding the right coverage at the lowest possible cost.
- Encourage them to visit www.ciapro.net for online quotes or more information.

# Things to Avoid

- Don't provide specific quotes or pricing. Always let callers know an agent will provide personalized quotes.
- Don't give legal or claims advice. Defer to the licensed agents.
- Don't make promises about coverage or rates. Use phrases like "Our agents will find the best options for you."
- Don't argue or get defensive. Stay calm and helpful even with frustrated callers.
- Don't rush callers. Let them fully explain their needs.
- Don't say "I don't know" alone. Instead say "Let me make sure an agent gets you that information."

# Handling Difficult Situations

## Frustrated or Upset Callers
1. Listen fully without interrupting.
2. Acknowledge their frustration: "I completely understand how frustrating that must be."
3. Apologize for the inconvenience.
4. Focus on solving: "Let me make sure we get this taken care of for you right away."
5. Take detailed notes so the agent has full context.

## Wrong Numbers or Non-Insurance Calls
Be polite and helpful:
"No problem at all! It sounds like you may have the wrong number. This is Chrysalis Insurance Agency. Is there anything insurance-related I can help you with today? If not, no worries, have a great day!"

# Closing the Call

End every call warmly:
- Summarize what you've captured.
- Set expectations about when they'll hear back.
- Thank them sincerely: "Thanks so much for calling Chrysalis Insurance Agency! We appreciate you and look forward to helping you. Have a wonderful day!"`;

// ============================================================================
// Call Notes & Quote Request Storage
// ============================================================================

interface CallNote {
  timestamp: string;
  callerName: string;
  phoneNumber: string;
  email: string | undefined;
  reason: string;
  insuranceType: string | undefined;
  details: string;
  urgency: 'low' | 'medium' | 'high';
  requestedAgent: string | undefined;
  isExistingClient: boolean;
  ezlynxCustomerId?: string | undefined;
}

interface QuoteRequest {
  timestamp: string;
  callerName: string;
  phoneNumber: string;
  email?: string | undefined;
  insuranceTypes: string[];
  vehicleInfo?: string | undefined;
  address?: string | undefined;
  driverCount?: number | undefined;
  ownsHome?: boolean | undefined;
  preferredChannel: 'phone' | 'text' | 'email';
  bundleInterest: boolean;
  callbackPreferred: boolean;
  callbackTime?: string | undefined;
  notes?: string | undefined;
}

interface MessageRequest {
  timestamp: string;
  callerName: string;
  phoneNumber: string;
  forAgent?: string | undefined;
  message: string;
  urgency: 'low' | 'medium' | 'high';
  preferredCallbackTime?: string | undefined;
  reason: string;
}

// ============================================================================
// Session-Scoped State Management
// ============================================================================
// CRITICAL: All per-call state MUST be stored in session data, NOT module-level
// variables. Module-level state persists across all calls causing data leakage.

interface SessionData {
  callNotes: CallNote[];
  quoteRequests: QuoteRequest[];
  messageRequests: MessageRequest[];
  customerContext: CustomerContext;
}

interface ProcUserData {
  vad: silero.VAD;
  sessions: Map<string, SessionData>;
}

/**
 * Get or initialize session data for a specific room/session.
 * This ensures each call has isolated state.
 */
function getSessionData(roomName: string, userData: ProcUserData): SessionData {
  if (!userData.sessions) {
    userData.sessions = new Map<string, SessionData>();
  }
  if (!userData.sessions.has(roomName)) {
    userData.sessions.set(roomName, {
      callNotes: [],
      quoteRequests: [],
      messageRequests: [],
      customerContext: {
        lookupAttempted: false,
        lookupSuccessful: false,
        collectedInfo: {},
      },
    });
    console.log(`[SessionData] Initialized session data for room: ${roomName}`);
  }
  return userData.sessions.get(roomName)!;
}

/**
 * Clean up session data when a call ends.
 * This prevents memory leaks from accumulating session data.
 */
function cleanupSessionData(roomName: string, userData: ProcUserData): void {
  if (userData.sessions) {
    const sessionData = userData.sessions.get(roomName);
    if (sessionData) {
      // Log session summary before cleanup
      console.log(`[SessionData] Session summary for room ${roomName}:`);
      console.log(`  - Call notes: ${sessionData.callNotes.length}`);
      console.log(`  - Quote requests: ${sessionData.quoteRequests.length}`);
      console.log(`  - Message requests: ${sessionData.messageRequests.length}`);
      console.log(`  - Customer lookup: ${sessionData.customerContext.lookupSuccessful ? 'found' : 'not found'}`);
    }
    userData.sessions.delete(roomName);
    console.log(`[SessionData] Cleaned up session data for room: ${roomName}`);
  }
}

/**
 * Format customer policies for voice output
 */
function formatPoliciesForVoice(customer: EZLynxCustomerRecord): string {
  if (!customer.policies || customer.policies.length === 0) {
    return 'No active policies found in the system.';
  }

  const policyDescriptions = customer.policies.map((policy) => {
    const status = policy.status === 'active' ? 'active' : policy.status;
    return `${policy.policyType} insurance with ${policy.carrier}, policy number ${policy.policyNumber}, status ${status}`;
  });

  if (policyDescriptions.length === 1) {
    return `I found one policy: ${policyDescriptions[0]}.`;
  }

  return `I found ${policyDescriptions.length} policies: ${policyDescriptions.join('; ')}.`;
}

// ============================================================================
// Tool Factory Functions
// ============================================================================
// Tools are created as factory functions that receive the session context,
// allowing them to access session-scoped state instead of module-level variables.

function createTools(roomName: string, userData: ProcUserData) {
  // Helper to get session data for this room
  const getSession = () => getSessionData(roomName, userData);

  return {
    // ====================================================================
    // EZLynx Customer Lookup Tools
    // ====================================================================

    lookupCustomer: llm.tool({
      description: `Use this tool to look up a customer's information in our CRM system using their phone number.
        Call this tool early in the conversation when you have the caller's phone number.
        This will retrieve their name, policies, and account information if they are an existing customer.
        If the customer is found, use their information to personalize the conversation.`,
      parameters: z.object({
        phoneNumber: z.string().describe("The caller's phone number in any format"),
        callerName: z.string().optional().describe("The caller's name if they've provided it"),
      }),
      execute: async ({ phoneNumber, callerName }) => {
        try {
          const session = getSession();

          // Validate phone number before lookup
          const phoneResult = validatePhone(phoneNumber);
          if (!phoneResult.isValid) {
            return {
              found: false,
              error: phoneResult.error,
              message: "I couldn't validate that phone number. Could you repeat it for me?",
            };
          }

          // Use validated and normalized phone number
          const normalizedPhone = phoneResult.normalized!;

          const service = getEZLynxService();

          session.customerContext.lookupAttempted = true;
          session.customerContext.collectedInfo.phoneNumber = normalizedPhone;
          if (callerName) {
            session.customerContext.collectedInfo.name = callerName;
          }

          if (!service.isEnabled()) {
            console.log('[EZLynx] Integration not enabled');
            return {
              found: false,
              message:
                'Customer lookup is not currently available. Please proceed with collecting their information.',
            };
          }

          try {
            const response = await service.lookupCustomer({
              phoneNumber: normalizedPhone,
              callerName,
              timestamp: new Date().toISOString(),
              sessionId: roomName,
            });

            if (response.success && response.data?.found) {
              session.customerContext.lookupSuccessful = true;
              session.customerContext.customer = response.data;
              session.customerContext.lookupTimestamp = new Date().toISOString();

              const customer = response.data;
              const policyInfo = formatPoliciesForVoice(customer);

              return {
                found: true,
                customerName: customer.fullName,
                firstName: customer.firstName,
                preferredAgent: customer.preferredAgent,
                isPriority: customer.isPriority,
                policyCount: customer.policies?.length ?? 0,
                policySummary: policyInfo,
                message: `Found existing customer: ${customer.fullName}. ${policyInfo}`,
              };
            }

            session.customerContext.lookupSuccessful = false;
            return {
              found: false,
              message: 'No existing customer record found. This appears to be a new caller.',
            };
          } catch (error) {
            console.error('[EZLynx] Lookup error:', error);
            session.customerContext.lookupSuccessful = false;
            return {
              found: false,
              message:
                'Unable to look up customer information at this time. Please proceed normally.',
            };
          }
        } catch (error) {
          console.error('[lookupCustomer] Error:', error);
          return {
            found: false,
            error: 'An unexpected error occurred. Please try again.',
          };
        }
      },
    }),

    // ====================================================================
    // Enhanced Quote Flow Tools
    // ====================================================================

    captureQuoteRequest: llm.tool({
      description: `Use this tool to capture a complete quote request with all gathered information.
        Call this after gathering the caller's insurance needs, vehicle info, address, and preferences.`,
      parameters: z.object({
        callerName: z.string().describe('Full name of the caller'),
        phoneNumber: z.string().describe('Best callback phone number'),
        email: z.string().optional().describe('Email address if provided'),
        insuranceTypes: z
          .array(z.enum(['auto', 'home', 'renters', 'business', 'life', 'flood', 'specialty']))
          .describe('Types of insurance requested'),
        vehicleInfo: z
          .string()
          .optional()
          .describe('Vehicle year, make, model for auto quotes'),
        address: z.string().optional().describe('Full address for accurate rating'),
        driverCount: z.number().optional().describe('Number of drivers on policy'),
        ownsHome: z.boolean().optional().describe('Whether caller owns or rents'),
        preferredChannel: z
          .enum(['phone', 'text', 'email'])
          .describe('How they want to receive quote info'),
        bundleInterest: z.boolean().describe('Interested in bundling multiple policies'),
        callbackPreferred: z.boolean().describe('Prefers agent callback vs giving info now'),
        callbackTime: z.string().optional().describe('Preferred callback time'),
        notes: z.string().optional().describe('Additional notes about the request'),
      }),
      execute: async ({
        callerName,
        phoneNumber,
        email,
        insuranceTypes,
        vehicleInfo,
        address,
        driverCount,
        ownsHome,
        preferredChannel,
        bundleInterest,
        callbackPreferred,
        callbackTime,
        notes,
      }) => {
        try {
          const session = getSession();

          const request: QuoteRequest = {
            timestamp: new Date().toISOString(),
            callerName,
            phoneNumber,
            email,
            insuranceTypes,
            vehicleInfo,
            address,
            driverCount,
            ownsHome,
            preferredChannel,
            bundleInterest,
            callbackPreferred,
            callbackTime,
            notes,
          };

          session.quoteRequests.push(request);
          safeLog(`[Room: ${roomName}] Quote request captured:`, request);

          const bundleNote = bundleInterest ? ' with bundling interest' : '';
          const types = insuranceTypes.join(', ');

          return `Quote request saved for ${callerName}: ${types}${bundleNote}. An agent will ${callbackPreferred ? `call back ${callbackTime ? 'at ' + callbackTime : 'shortly'}` : 'reach out with personalized quotes'}.`;
        } catch (error) {
          console.error('[captureQuoteRequest] Error:', error);
          return 'An unexpected error occurred while saving your quote request. Please try again.';
        }
      },
    }),

    // ====================================================================
    // Call Routing & Transfer Tools
    // ====================================================================

    checkOfficeHours: llm.tool({
      description: `Use this tool to check if the Chrysalis Insurance Agency office is currently open.
        Call this at the start of calls or when discussing availability.
        Returns whether the office is open and the current Pacific Time.`,
      parameters: z.object({}),
      execute: async () => {
        try {
          const now = new Date();
          const pacificTime = new Date(
            now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
          );
          const day = pacificTime.getDay();
          const hour = pacificTime.getHours();

          const isWeekday = day >= 1 && day <= 5;
          const isBusinessHours = hour >= 9 && hour < 17;
          const isOpen = isWeekday && isBusinessHours;

          const timeString = pacificTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          const dayName = pacificTime.toLocaleDateString('en-US', {
            weekday: 'long',
          });

          // Calculate next business day for after-hours messaging
          let nextBusinessDay = 'tomorrow';
          if (day === 5 && hour >= 17) nextBusinessDay = 'Monday';
          if (day === 6) nextBusinessDay = 'Monday';
          if (day === 0) nextBusinessDay = 'Monday';

          return {
            isOpen,
            currentTime: timeString,
            currentDay: dayName,
            nextBusinessDay,
            message: isOpen
              ? `The office is currently open. It's ${timeString} on ${dayName} Pacific Time.`
              : `The office is currently closed. It's ${timeString} on ${dayName} Pacific Time. Office hours are Monday through Friday, 9 AM to 5 PM Pacific Time. Agents will be back at 8 AM on ${nextBusinessDay}.`,
          };
        } catch (error) {
          console.error('[checkOfficeHours] Error:', error);
          return {
            isOpen: false,
            error: 'An unexpected error occurred. Please try again.',
          };
        }
      },
    }),

    checkAgentAvailability: llm.tool({
      description: `Use this tool to check if a specific team member is available for a transfer.
        Call this before attempting a warm transfer.`,
      parameters: z.object({
        agentName: z
          .enum(['Melissa', 'Riley', 'Cherry', 'Bryce', 'Glen', 'Eric'])
          .describe('Name of the team member to check'),
      }),
      execute: async ({ agentName }) => {
        try {
          // Real-time availability checking is not yet configured
          // Always return unavailable until integration with phone system is complete
          console.log(
            `[AVAILABILITY_CHECK] Checked availability for ${agentName} - system not yet configured`,
          );

          return {
            agentName,
            available: false,
            message: `Real-time availability checking is being configured. Let me take a message instead.`,
          };
        } catch (error) {
          console.error('[checkAgentAvailability] Error:', error);
          return {
            available: false,
            error: 'An unexpected error occurred. Please try again.',
          };
        }
      },
    }),

    warmTransfer: llm.tool({
      description: `Use this tool to perform a warm transfer to a team member.
        This provides the receiving agent with full context about the caller.
        Use checkAgentAvailability first to verify they can take the call.`,
      parameters: z.object({
        targetAgent: z
          .enum(['Melissa', 'Riley', 'Cherry', 'Bryce', 'Glen', 'Eric'])
          .describe('Name of the agent to transfer to'),
        callerName: z.string().describe('Name of the caller'),
        isExistingClient: z.boolean().describe('Whether caller is an existing client'),
        reason: z.string().describe('Reason for the call/transfer'),
        additionalContext: z
          .string()
          .optional()
          .describe('Any additional context to provide (policy numbers, urgency, etc.)'),
      }),
      execute: async ({
        targetAgent,
        callerName,
        isExistingClient,
        reason,
        additionalContext,
      }) => {
        try {
          const session = getSession();
          const clientStatus = isExistingClient ? 'an existing client' : 'a new caller';
          const contextString = additionalContext
            ? ` Additional context: ${additionalContext}`
            : '';

          // Include customer context if available
          let customerInfo = '';
          if (session.customerContext.lookupSuccessful && session.customerContext.customer) {
            const customer = session.customerContext.customer;
            customerInfo = ` Customer ID: ${customer.customerId}.`;
          }

          // Generate the announcement for when real transfers are implemented
          const transferAnnouncement = `I have ${callerName} on the line. They're ${clientStatus} asking about ${reason}.${contextString}${customerInfo}`;

          // Log transfer request with marker for staff follow-up
          console.log(
            `[Room: ${roomName}] [TRANSFER_REQUEST] Target: ${targetAgent} | Caller: ${callerName} | Client: ${isExistingClient} | Reason: ${reason} | Context: ${additionalContext || 'none'}`,
          );
          console.log(`[Room: ${roomName}] [TRANSFER_REQUEST] Prepared announcement: ${transferAnnouncement}`);

          // Real-time transfer is not yet implemented
          // Return pending status so staff can follow up
          return {
            success: false,
            pending: true,
            targetAgent,
            announcement: transferAnnouncement,
            message: `I'll arrange for ${targetAgent} to call you right back. They'll have all the context about your call.`,
          };
        } catch (error) {
          console.error('[warmTransfer] Error:', error);
          return {
            success: false,
            error: 'An unexpected error occurred. Please try again.',
          };
        }
      },
    }),

    takeMessage: llm.tool({
      description: `Use this tool when an agent is unavailable and the caller wants to leave a message.
        Records the message for callback.`,
      parameters: z.object({
        callerName: z.string().describe('Name of the caller'),
        phoneNumber: z.string().describe('Best callback number'),
        forAgent: z
          .enum(['Melissa', 'Riley', 'Cherry', 'Bryce', 'Glen', 'Eric'])
          .optional()
          .describe('Specific agent the message is for'),
        message: z.string().describe('The message content'),
        urgency: z.enum(['low', 'medium', 'high']).describe('How urgent is the callback'),
        preferredCallbackTime: z
          .string()
          .optional()
          .describe('When they prefer to be called back'),
        reason: z
          .enum(['quote', 'policy_service', 'claim', 'billing', 'general'])
          .describe('Category of the inquiry'),
      }),
      execute: async ({
        callerName,
        phoneNumber,
        forAgent,
        message,
        urgency,
        preferredCallbackTime,
        reason,
      }) => {
        try {
          const session = getSession();

          const msgRequest: MessageRequest = {
            timestamp: new Date().toISOString(),
            callerName,
            phoneNumber,
            forAgent,
            message,
            urgency,
            preferredCallbackTime,
            reason,
          };

          session.messageRequests.push(msgRequest);
          safeLog(`[Room: ${roomName}] Message recorded:`, msgRequest);

          const agentText = forAgent ? `for ${forAgent}` : '';
          const timeText = preferredCallbackTime
            ? ` around ${preferredCallbackTime}`
            : ' as soon as possible';

          return `Message recorded ${agentText}. ${forAgent || 'Someone from our team'} will call you back at ${phoneNumber}${timeText}.`;
        } catch (error) {
          console.error('[takeMessage] Error:', error);
          return 'An unexpected error occurred while recording your message. Please try again.';
        }
      },
    }),

    // ====================================================================
    // Claims Flow Tools
    // ====================================================================

    recordClaimInquiry: llm.tool({
      description: `Use this tool to record a claim inquiry or claim-related call.
        Captures the essential claim information and caller preference for handling.`,
      parameters: z.object({
        callerName: z.string().describe('Name of the caller'),
        phoneNumber: z.string().describe('Callback number'),
        claimType: z
          .string()
          .optional()
          .describe('Type of claim (auto accident, property damage, etc.)'),
        description: z.string().optional().describe('Brief description of what happened'),
        policyNumber: z.string().optional().describe('Policy number if known'),
        preferredHandling: z
          .enum(['speak_agent', 'file_now', 'carrier_transfer', 'callback'])
          .describe('How they want to proceed'),
        dateOfIncident: z.string().optional().describe('When the incident occurred'),
      }),
      execute: async ({
        callerName,
        phoneNumber,
        claimType,
        description,
        policyNumber,
        preferredHandling,
        dateOfIncident,
      }) => {
        try {
          const session = getSession();

          const note: CallNote = {
            timestamp: new Date().toISOString(),
            callerName,
            phoneNumber,
            email: undefined,
            reason: 'claim',
            insuranceType: claimType || 'unknown',
            details: `Claim inquiry: ${description || 'Details to be gathered'}. Date: ${dateOfIncident || 'Unknown'}. Policy: ${policyNumber || 'Unknown'}. Preferred handling: ${preferredHandling}`,
            urgency: 'high',
            requestedAgent: undefined,
            isExistingClient: true,
            ezlynxCustomerId: session.customerContext.customer?.customerId,
          };

          session.callNotes.push(note);
          safeLog(`[Room: ${roomName}] Claim inquiry recorded:`, note);

          const handlingMessages = {
            speak_agent: 'I have your information recorded. Let me connect you with an agent.',
            file_now: 'Got it. Let me transfer you to your carrier to file the claim now.',
            carrier_transfer: "Connecting you to your carrier's claims line now.",
            callback:
              'I have all your information. An agent will call you back shortly to help with your claim.',
          };

          return handlingMessages[preferredHandling];
        } catch (error) {
          console.error('[recordClaimInquiry] Error:', error);
          return 'An unexpected error occurred while recording your claim inquiry. Please try again.';
        }
      },
    }),

    // ====================================================================
    // Legacy Tools (kept for compatibility)
    // ====================================================================

    captureCallNotes: llm.tool({
      description: `Use this tool to capture and save caller information for agent follow-up.
        Call this tool when you have gathered the caller's details during the conversation.
        This ensures no information is lost and agents can follow up appropriately.`,
      parameters: z.object({
        callerName: z.string().describe('Full name of the caller'),
        phoneNumber: z.string().describe('Best callback phone number'),
        email: z.string().optional().describe('Email address if provided'),
        reason: z
          .enum([
            'new_quote',
            'policy_service',
            'claim',
            'payment',
            'general_question',
            'other',
          ])
          .describe('Primary reason for the call'),
        insuranceType: z
          .enum([
            'auto',
            'home',
            'business',
            'life',
            'renters',
            'flood',
            'specialty',
            'unknown',
          ])
          .optional()
          .describe('Type of insurance discussed'),
        details: z.string().describe('Key details and notes from the conversation'),
        urgency: z
          .enum(['low', 'medium', 'high'])
          .describe(
            'Urgency level - high for expiring policies, claims, or time-sensitive matters',
          ),
        requestedAgent: z
          .enum(['Eric', 'Cherry', 'Bryce', 'Glen', 'Melissa', 'Riley', 'none'])
          .optional()
          .describe('Specific agent requested by the caller, if any'),
      }),
      execute: async ({
        callerName,
        phoneNumber,
        email,
        reason,
        insuranceType,
        details,
        urgency,
        requestedAgent,
      }) => {
        try {
          const session = getSession();

          const note: CallNote = {
            timestamp: new Date().toISOString(),
            callerName,
            phoneNumber,
            email,
            reason,
            insuranceType,
            details,
            urgency,
            requestedAgent: requestedAgent === 'none' ? undefined : requestedAgent,
            isExistingClient: session.customerContext.lookupSuccessful,
            ezlynxCustomerId: session.customerContext.customer?.customerId,
          };

          session.callNotes.push(note);
          safeLog(`[Room: ${roomName}] Call notes captured:`, note);

          return `Call notes saved successfully for ${callerName}. An agent will follow up ${urgency === 'high' ? 'as soon as possible' : 'shortly'}.`;
        } catch (error) {
          console.error('[captureCallNotes] Error:', error);
          return 'An unexpected error occurred while saving the call notes. Please try again.';
        }
      },
    }),

    endCall: llm.tool({
      description: `Use this tool when the caller indicates they want to end the call or when the conversation has naturally concluded.
        This ensures a warm, professional closing.`,
      parameters: z.object({
        summary: z
          .string()
          .describe('Brief summary of what was discussed or accomplished during the call'),
      }),
      execute: async ({ summary }) => {
        try {
          const session = getSession();
          console.log(`[Room: ${roomName}] Call ended. Summary: ${summary}`);
          console.log(`[Room: ${roomName}] Session had ${session.callNotes.length} call notes, ${session.quoteRequests.length} quote requests, ${session.messageRequests.length} messages`);

          // Note: Session cleanup happens in the shutdown callback, not here
          // This allows the session data to persist until the agent truly disconnects

          return 'Call concluded successfully.';
        } catch (error) {
          console.error('[endCall] Error:', error);
          return 'An unexpected error occurred while ending the call. Please try again.';
        }
      },
    }),
  };
}

// ============================================================================
// Assistant Class - Iris
// ============================================================================

class Assistant extends voice.Agent {
  private roomName: string;
  private userData: ProcUserData;

  constructor(roomName: string, userData: ProcUserData) {
    // Create tools with session context
    const tools = createTools(roomName, userData);

    super({
      instructions: IRIS_INSTRUCTIONS,
      tools,
    });

    this.roomName = roomName;
    this.userData = userData;
  }

  // Iris greets the caller when they connect
  override async onEnter(): Promise<void> {
    // Initialize session data for this room (if not already done)
    getSessionData(this.roomName, this.userData);
    console.log(`[Room: ${this.roomName}] Iris entering conversation`);

    // Use generateReply to let the LLM create a natural, varied greeting
    this.session.generateReply({
      instructions:
        'Greet the caller warmly as Iris, the Chrysalis Insurance receptionist. Keep it brief and friendly.',
    });
  }
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    const userData = proc.userData as unknown as ProcUserData;
    userData.vad = await silero.VAD.load();
    // Initialize the sessions map during prewarm
    userData.sessions = new Map<string, SessionData>();
    console.log('[Prewarm] VAD loaded and sessions map initialized');
  },
  entry: async (ctx: JobContext) => {
    const userData = ctx.proc.userData as unknown as ProcUserData;
    const roomName = ctx.room.name || `room-${Date.now()}`;

    console.log(`[Entry] Starting session for room: ${roomName}`);

    // Set up a voice AI pipeline using OpenAI, Cartesia, AssemblyAI, and the LiveKit turn detector
    const session = new voice.AgentSession({
      // Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
      // See all available models at https://docs.livekit.io/agents/models/stt/
      stt: new inference.STT({
        model: 'assemblyai/universal-streaming',
        language: 'en',
        modelOptions: {
          // Boost recognition of insurance-related terms for faster, more accurate transcription
          keyterms_prompt: [
            'Chrysalis Insurance',
            'auto insurance',
            'home insurance',
            'renters insurance',
            'life insurance',
            'business insurance',
            'flood insurance',
            'policy',
            'premium',
            'deductible',
            'coverage',
            'claim',
            'quote',
            'Progressive',
            'State Farm',
            'Allstate',
            'Geico',
            'liability',
            'collision',
            'comprehensive',
            'Costa Mesa',
            'Boise',
            'Idaho',
            'California',
            'Eric',
            'Cherry',
            'Melissa',
            'Riley',
            'Bryce',
            'Glen',
          ],
        },
      }),

      // A Large Language Model (LLM) is your agent's brain, processing user input and generating a response
      // See all providers at https://docs.livekit.io/agents/models/llm/
      llm: new inference.LLM({
        model: 'openai/gpt-4.1-mini',
      }),

      // Text-to-speech (TTS) - Iris's voice
      // Using "Jacqueline" - Confident, young American adult female
      // Explore more voices at https://play.cartesia.ai/voices
      tts: new inference.TTS({
        model: 'cartesia/sonic-3',
        voice: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc', // Jacqueline - American female
        language: 'en',
        modelOptions: {
          speed: 1.1, // Snappy, natural conversational pace
          volume: 1.0,
        },
      }),

      // VAD and turn detection are used to determine when the user is speaking and when the agent should respond
      // See more at https://docs.livekit.io/agents/build/turns
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      vad: userData.vad,
      voiceOptions: {
        // Allow the LLM to generate a response while waiting for the end of turn
        preemptiveGeneration: true,
      },
    });

    // Metrics collection, to measure pipeline performance
    // For more information, see https://docs.livekit.io/agents/build/metrics/
    const usageCollector = new metrics.UsageCollector();
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      metrics.logMetrics(ev.metrics);
      usageCollector.collect(ev.metrics);
    });

    const logUsage = async () => {
      const summary = usageCollector.getSummary();
      console.log(`[Room: ${roomName}] Usage: ${JSON.stringify(summary)}`);
    };

    ctx.addShutdownCallback(async () => {
      await logUsage();
      // Clean up session data when the call ends
      cleanupSessionData(roomName, userData);
    });

    // Start the session, which initializes the voice pipeline and warms up the models
    await session.start({
      agent: new Assistant(roomName, userData),
      room: ctx.room,
      inputOptions: {
        // LiveKit Cloud enhanced noise cancellation
        // - If self-hosting, omit this parameter
        // - For telephony applications, use `BackgroundVoiceCancellationTelephony` for best results
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });

    // Join the room and connect to the user
    await ctx.connect();
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'iris-agent',
  }),
);
