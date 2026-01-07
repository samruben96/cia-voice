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

dotenv.config({ path: '.env.local' });

// ============================================================================
// IRIS - Virtual Receptionist for Chrysalis Insurance Agency
// ============================================================================

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

## Key Team Members
- Eric: President and Owner
- Cherry: Agent and Customer Service
- Bryce: Agent
- Glen: Agent

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
- Keep replies conversational and concise. One to three sentences at a time. Ask one question at a time.
- Spell out phone numbers naturally (e.g., "seven one four, four six four, eight zero eight zero").
- Spell out email addresses naturally (e.g., "service at c i a pro dot net").
- Avoid insurance jargon unless the caller uses it first.

# Conversation Guidelines

## Opening Greeting
When answering, say something warm like:
"Hi there! Thanks for calling Chrysalis Insurance Agency, this is Iris. How can I help you today?"

Keep it warm and natural. Vary slightly so it doesn't sound robotic.

## Tone & Style
- Be warm and friendly, genuinely kind like a helpful neighbor.
- Be patient. Never rush the caller. Let them explain fully.
- Be sweet but professional. Approachable, not overly casual.
- Be empathetic. Acknowledge frustrations since insurance can be stressful.
- Be positive. Focus on solutions, not limitations.
- Be clear and concise. Respect their time.

## Active Listening
- Use brief verbal acknowledgments: "Mm-hmm," "I see," "Got it," "Of course."
- Reflect back key details to confirm understanding.
- Ask clarifying questions when needed.

# Call Handling Procedures

## 1. New Quote Requests
If the caller wants a quote:
1. Express enthusiasm: "Wonderful! We'd love to help you with that."
2. Ask what type of insurance they need.
3. Collect their information: full name, callback phone number, email address, brief description of what they need covered, and any timeline or urgency.
4. Let them know: "I'll make sure one of our agents reaches out to you shortly to get you a personalized quote. They'll shop multiple carriers to find you the best coverage at the best price!"
5. Use the captureCallNotes tool to save their information.

## 2. Existing Client Inquiries
If they're an existing client:
1. Ask for their name to identify them.
2. Ask what they need help with: policy questions, making a payment, requesting documents or ID cards, updating information, filing or checking on a claim, renewal questions, or adding/removing coverage.
3. Take detailed notes and let them know an agent will follow up.
4. If urgent, offer to transfer or have someone call back as soon as possible.

## 3. Claims Assistance
If they need to file a claim or have claim questions:
1. Express empathy: "I'm so sorry to hear that. Let me make sure we get you the help you need."
2. Gather their name, policy info if available, and a brief description of what happened.
3. Explain: "One of our team members will reach out to you right away to guide you through the claims process."

## 4. Transferring Calls
When transferring to a specific team member, use the requestTransfer tool.
- If unavailable: "It looks like they're currently with another client. Can I take a message and have them call you back?"

## 5. General Information Requests
For general questions about services:
- Explain that Chrysalis is an independent insurance agency that shops multiple carriers.
- They serve clients throughout California and Idaho.
- They specialize in finding the right coverage at the lowest possible cost.
- Encourage them to visit www.ciapro.net for online quotes or more information.

## 6. After-Hours Calls
If calling outside business hours (use the checkOfficeHours tool to verify):
"Thanks for calling Chrysalis Insurance Agency! Our office is currently closed. Our hours are Monday through Friday, 9 AM to 5 PM Pacific Time. Please leave your name, number, and a brief message, and one of our team members will get back to you on the next business day. If this is an urgent claim, please contact your insurance carrier directly."

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
// Call Notes Storage (in-memory for now, would connect to CRM in production)
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
}

const callNotes: CallNote[] = [];

// ============================================================================
// Assistant Class - Iris
// ============================================================================

class Assistant extends voice.Agent {
  constructor() {
    super({
      instructions: IRIS_INSTRUCTIONS,

      tools: {
        // Tool to capture call notes for follow-up
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
            details: z
              .string()
              .describe('Key details and notes from the conversation'),
            urgency: z
              .enum(['low', 'medium', 'high'])
              .describe(
                'Urgency level - high for expiring policies, claims, or time-sensitive matters'
              ),
            requestedAgent: z
              .enum(['Eric', 'Cherry', 'Bryce', 'Glen', 'none'])
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
            };

            callNotes.push(note);
            console.log('📝 Call note captured:', JSON.stringify(note, null, 2));

            return `Call notes saved successfully for ${callerName}. An agent will follow up ${urgency === 'high' ? 'as soon as possible' : 'shortly'}.`;
          },
        }),

        // Tool to check if office is currently open
        checkOfficeHours: llm.tool({
          description: `Use this tool to check if the Chrysalis Insurance Agency office is currently open.
          Call this at the start of calls or when discussing availability.
          Returns whether the office is open and the current Pacific Time.`,
          parameters: z.object({}),
          execute: async () => {
            // Get current time in Pacific timezone
            const now = new Date();
            const pacificTime = new Date(
              now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
            );
            const day = pacificTime.getDay();
            const hour = pacificTime.getHours();
            const minute = pacificTime.getMinutes();

            const isWeekday = day >= 1 && day <= 5;
            const isBusinessHours = hour >= 9 && hour < 17;
            const isOpen = isWeekday && isBusinessHours;

            const timeString = pacificTime.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });
            const dayName = pacificTime.toLocaleDateString('en-US', { weekday: 'long' });

            return {
              isOpen,
              currentTime: timeString,
              currentDay: dayName,
              message: isOpen
                ? `The office is currently open. It's ${timeString} on ${dayName} Pacific Time.`
                : `The office is currently closed. It's ${timeString} on ${dayName} Pacific Time. Office hours are Monday through Friday, 9 AM to 5 PM Pacific Time.`,
            };
          },
        }),

        // Tool to request transfer to a specific team member
        requestTransfer: llm.tool({
          description: `Use this tool when a caller asks to speak with a specific team member.
          This will log the transfer request. In production, this would initiate an actual call transfer.`,
          parameters: z.object({
            agentName: z
              .enum(['Eric', 'Cherry', 'Bryce', 'Glen'])
              .describe('Name of the agent to transfer to'),
            callerName: z.string().describe('Name of the caller requesting the transfer'),
            reason: z.string().describe('Brief reason for the transfer request'),
          }),
          execute: async ({ agentName, callerName, reason }) => {
            console.log(
              `📞 Transfer requested: ${callerName} -> ${agentName} | Reason: ${reason}`
            );

            // In production, this would integrate with a phone system to transfer the call
            // For now, we'll simulate checking availability
            const isAvailable = Math.random() > 0.3; // 70% chance available for demo

            if (isAvailable) {
              return `${agentName} is available. Transferring the call now. Please hold for just a moment.`;
            } else {
              return `${agentName} is currently with another client. Would you like to leave a message for them to call you back, or would you like me to help you with something else?`;
            }
          },
        }),

        // Tool to end the call gracefully
        endCall: llm.tool({
          description: `Use this tool when the caller indicates they want to end the call or when the conversation has naturally concluded.
          This ensures a warm, professional closing.`,
          parameters: z.object({
            summary: z
              .string()
              .describe('Brief summary of what was discussed or accomplished during the call'),
          }),
          execute: async ({ summary }) => {
            console.log(`📞 Call ended. Summary: ${summary}`);
            return 'Call concluded successfully.';
          },
        }),
      },
    });
  }

  // Iris greets the caller when they connect
  override async onEnter(): Promise<void> {
    // Use generateReply to let the LLM create a natural, varied greeting
    this.session.generateReply({
      instructions: 'Greet the caller warmly as Iris, the Chrysalis Insurance receptionist. Keep it brief and friendly.',
    });
  }
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    // Set up a voice AI pipeline using OpenAI, Cartesia, AssemblyAI, and the LiveKit turn detector
    const session = new voice.AgentSession({
      // Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
      // See all available models at https://docs.livekit.io/agents/models/stt/
      stt: new inference.STT({
        model: 'assemblyai/universal-streaming',
        language: 'en',
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
          speed: 0.95, // Slightly slower for warmth and clarity
          volume: 1.0,
        },
      }),

      // VAD and turn detection are used to determine when the user is speaking and when the agent should respond
      // See more at https://docs.livekit.io/agents/build/turns
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      vad: ctx.proc.userData.vad! as silero.VAD,
      voiceOptions: {
        // Allow the LLM to generate a response while waiting for the end of turn
        preemptiveGeneration: true,
      },
    });

    // To use a realtime model instead of a voice pipeline, use the following session setup instead.
    // (Note: This is for the OpenAI Realtime API. For other providers, see https://docs.livekit.io/agents/models/realtime/))
    // 1. Install '@livekit/agents-plugin-openai'
    // 2. Set OPENAI_API_KEY in .env.local
    // 3. Add import `import * as openai from '@livekit/agents-plugin-openai'` to the top of this file
    // 4. Use the following session setup instead of the version above
    // const session = new voice.AgentSession({
    //   llm: new openai.realtime.RealtimeModel({ voice: 'marin' }),
    // });

    // Metrics collection, to measure pipeline performance
    // For more information, see https://docs.livekit.io/agents/build/metrics/
    const usageCollector = new metrics.UsageCollector();
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      metrics.logMetrics(ev.metrics);
      usageCollector.collect(ev.metrics);
    });

    const logUsage = async () => {
      const summary = usageCollector.getSummary();
      console.log(`Usage: ${JSON.stringify(summary)}`);
    };

    ctx.addShutdownCallback(logUsage);

    // Start the session, which initializes the voice pipeline and warms up the models
    await session.start({
      agent: new Assistant(),
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

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
