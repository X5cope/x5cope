// ==========================================================================
// X5cope Agent — menu tree
// Edit the text/options here anytime, no need to touch chat-widget.js
// ==========================================================================

export const AGENT_NAME = "X5cope Assistant";

export const MENU_TREE = {
  root: {
    bot: "Hey! I'm the X5cope assistant. What can I help you with?",
    options: [
      { label: "What services do you offer?", next: "services" },
      { label: "What do packages cost?", next: "packages" },
      { label: "I want to talk to a human", next: "human" },
      { label: "Something else", next: "ai_freeform" }
    ]
  },
  ai_freeform: {
    bot: "Sure, ask away, I'll do my best. You can always type 'human' if you'd rather talk to someone.",
    options: [],
    freeform: true
  },
  services: {
    bot: "We build: websites, AI chatbots, apps & PWAs, email marketing setups, Shopify stores, and ongoing maintenance retainers. Want details on one, or ready to talk to someone?",
    options: [
      { label: "Websites", next: "svc_websites" },
      { label: "AI Chatbots", next: "svc_bots" },
      { label: "Apps & Systems", next: "svc_apps" },
      { label: "I want to talk to a human", next: "human" },
      { label: "Back to menu", next: "root" }
    ]
  },
  svc_websites: {
    bot: "Landing pages or full multi-page sites, fast, mobile-first, and easy to update after launch.",
    options: [
      { label: "See pricing", next: "packages" },
      { label: "Talk to a human", next: "human" },
      { label: "Back to menu", next: "root" }
    ]
  },
  svc_bots: {
    bot: "WhatsApp or website bots that handle FAQs, capture leads, and hand off to a human when needed, basically what you're using right now.",
    options: [
      { label: "See pricing", next: "packages" },
      { label: "Talk to a human", next: "human" },
      { label: "Back to menu", next: "root" }
    ]
  },
  svc_apps: {
    bot: "Booking systems, member portals, trackers, full custom web apps for businesses that have outgrown spreadsheets and DMs.",
    options: [
      { label: "See pricing", next: "packages" },
      { label: "Talk to a human", next: "human" },
      { label: "Back to menu", next: "root" }
    ]
  },
  packages: {
    bot: "Four tiers: Launch (get online fast), Grow (site + chatbot), Scale (custom app + bot), and a Retainer add-on for ongoing maintenance. Exact pricing depends on scope, a human can confirm a number for your project.",
    options: [
      { label: "Talk to a human about pricing", next: "human" },
      { label: "Back to menu", next: "root" }
    ]
  },
  human: {
    bot: "Got it, connecting you with a person on the team now. Go ahead and type your message below, we'll reply as soon as we can.",
    options: [],
    escalate: true
  }
};
