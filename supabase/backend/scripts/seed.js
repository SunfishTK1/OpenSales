import { supabase } from '../db.js'

async function seed() {
  console.log('Clearing existing data...')
  await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('agent_runs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('communications').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('prospects').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  console.log('Seeding prospects...')
  const { data: prospects, error } = await supabase.from('prospects').insert([
    // Research
    { name: 'James Whitfield', email: 'james.whitfield@linearapp.io', phone: '+1 415 203 4421', company: 'Linear', industry: 'Developer Tools', title: 'VP of Engineering', stage: 'research', score: 72, source: 'imported', notes: 'Project management SaaS for software teams. 400k+ users. Currently on PlanetScale — migration opportunity.' },
    { name: 'Priya Anand', email: 'pranand@dub.co', phone: '+1 628 104 5567', company: 'Dub.co', industry: 'Developer Tools', title: 'Co-Founder & CTO', stage: 'research', score: 81, source: 'imported', notes: 'Open-source link management platform. Growing fast, self-hosting on Railway. Strong Postgres usage — ideal Supabase fit.' },
    { name: 'Marcus Bell', email: 'm.bell@rays.finance', phone: '+1 332 889 0012', company: 'Rays Finance', industry: 'Fintech', title: 'Head of Infrastructure', stage: 'research', score: 65, source: 'imported', notes: 'B2B expense management startup. Series A, ~60 employees. Uses Firebase — pain around real-time and auth complexity.' },
    // Outreach
    { name: 'Sofia Delgado', email: 'sofia@campsite.design', phone: '+1 510 774 3390', company: 'Campsite', industry: 'Design Tools', title: 'CEO', stage: 'outreach', score: 88, source: 'imported', notes: 'Design collaboration platform. 80k users. Actively evaluating backend providers — warm lead, responded to LinkedIn.' },
    { name: 'Nathan Wu', email: 'nwu@trieve.ai', phone: '+1 206 541 9923', company: 'Trieve', industry: 'AI / Search', title: 'CTO', stage: 'outreach', score: 79, source: 'imported', notes: 'AI-powered search infrastructure startup. Seed stage. Currently using raw Postgres on Render — needs auth + realtime.' },
    { name: 'Amara Okonkwo', email: 'amara@fleek.xyz', phone: '+1 929 387 2245', company: 'Fleek', industry: 'Web3 / Infra', title: 'Engineering Manager', stage: 'outreach', score: 61, source: 'imported', notes: 'Decentralized deployment platform. Small eng team, moving away from Hasura. Budget confirmed.' },
    // Responded
    { name: 'Daniel Park', email: 'dpark@outerbase.com', phone: '+1 650 918 7743', company: 'Outerbase', industry: 'Developer Tools', title: 'Founder & CEO', stage: 'responded', score: 91, source: 'imported', notes: 'Database UI platform — natural Supabase partner. Very interested in white-label and enterprise tier. Replied within 2 hours.' },
    { name: 'Zara Ahmed', email: 'zahmed@trigger.dev', phone: '+44 20 7946 0123', company: 'Trigger.dev', industry: 'Developer Tools', title: 'Co-Founder', stage: 'responded', score: 85, source: 'imported', notes: 'Open-source background jobs for developers. UK-based, Series A. High Postgres dependency — auth and storage add-on is compelling.' },
    // Discovery call
    { name: 'Lena Fischer', email: 'l.fischer@tella.tv', phone: '+49 30 120 94810', company: 'Tella', industry: 'Video / SaaS', title: 'Head of Product', stage: 'discovery_call', score: 77, source: 'imported', notes: 'Video recording SaaS. Berlin-based. On Supabase free tier already — discovery call to explore upgrading to Pro/Team.' },
    { name: 'Ravi Menon', email: 'ravi@basehub.com', phone: '+1 415 600 3312', company: 'BaseHub', industry: 'CMS / Dev Tools', title: 'CTO', stage: 'discovery_call', score: 83, source: 'imported', notes: 'Git-based CMS for developers. 12k users, growing 30% MoM. Call booked for this week. Strong Postgres + realtime needs.' },
    // High intent
    { name: 'Chloe Tran', email: 'chloe@makerkit.dev', phone: '+1 510 232 8841', company: 'MakerKit', industry: 'SaaS Starter / Dev Tools', title: 'Founder', stage: 'high_intent', score: 94, intent_score: 82, source: 'imported', notes: 'SaaS boilerplate built on Supabase. Wants enterprise agreement for reseller/partner pricing. Very high intent — decision maker engaged.' },
    { name: 'Omar Hassan', email: 'ohassan@resend.com', phone: '+1 332 740 9901', company: 'Resend', industry: 'Developer Tools / Email', title: 'VP Engineering', stage: 'high_intent', score: 89, intent_score: 76, source: 'imported', notes: 'Email API platform. 150k+ devs. Evaluating Supabase for internal tooling and customer data layer. Budget pre-approved.' },
    // Demo
    { name: 'Ingrid Larsen', email: 'ingrid@geist.sh', phone: '+47 21 05 3341', company: 'Geist', industry: 'Design / Dev Tools', title: 'CTO', stage: 'demo', score: 87, intent_score: 80, source: 'imported', notes: 'Design system tooling startup. Oslo-based. Demo scheduled — interested in Supabase Storage + Auth for their SaaS product.' },
    // Negotiation
    { name: 'Tom Gallagher', email: 'tgallagher@depot.dev', phone: '+1 415 809 2254', company: 'Depot', industry: 'Dev Infrastructure', title: 'CEO', stage: 'negotiation', score: 92, intent_score: 91, source: 'imported', notes: 'Faster Docker build infrastructure. 3k+ customers. In negotiation for Team plan with custom SLA. Legal reviewing contract.' },
    // Closed
    { name: 'Anya Petrova', email: 'anya@formbricks.com', phone: '+49 89 374 9201', company: 'Formbricks', industry: 'Open Source / SaaS', title: 'Co-Founder', stage: 'closed', score: 90, intent_score: 95, source: 'imported', notes: 'Open-source survey platform. Closed on Team plan. Upsell opportunity for Enterprise in Q3.' },
    // Real Retell call prospects
    { name: 'Hana Benko', email: 'hbenko@andrew.cmu.edu', company: 'CMU / Independent', industry: 'Higher Education / Research', title: 'Student Founder', stage: 'high_intent', score: 88, intent_score: 82, source: 'imported', notes: 'Evaluating Supabase Enterprise. Engaged positively on call — requested demo and pricing. Transferred to AE. (Retell call_db31e4c39d967afb73437b2d13e)' },
    { name: 'Dhiren Narne', email: 'dnarne@andrew.cmu.edu', company: 'CMU / Independent', industry: 'Higher Education / Research', title: 'Student Founder', stage: 'negotiation', score: 93, intent_score: 91, source: 'imported', notes: 'Extremely high intent — said "I am ready to make a deal right now." Transferred to AE for custom proposal. (Retell call_1caed158d5003bc14008bdc9cdc)' },
  ]).select()

  if (error) { console.error('Prospects error:', error.message); process.exit(1) }
  console.log(`Inserted ${prospects.length} prospects`)

  const byEmail = Object.fromEntries(prospects.map(p => [p.email, p.id]))

  console.log('Seeding communications...')
  const comms = []

  // Outbound cold emails for outreach+
  for (const p of prospects.filter(p => ['outreach','responded','discovery_call','high_intent','demo','negotiation','closed'].includes(p.stage))) {
    comms.push({ prospect_id: p.id, channel: 'email', direction: 'outbound', subject: `Quick question for ${p.company}`, content: `Hi ${p.name.split(' ')[0]}, I'm reaching out from Supabase. Given what you're building at ${p.company}, I think our platform could save your team significant time on auth, realtime, and storage. Worth a 20-minute call?`, status: 'sent' })
  }
  // Inbound replies for responded+
  for (const p of prospects.filter(p => ['responded','discovery_call','high_intent','demo','negotiation','closed'].includes(p.stage))) {
    comms.push({ prospect_id: p.id, channel: 'email', direction: 'inbound', subject: `Re: Quick question for ${p.company}`, content: `Hey! Yes this looks interesting — how about we jump on a call? I'm free Thursday or Friday morning.`, status: 'replied' })
  }
  // Follow-up emails for high_intent+
  for (const p of prospects.filter(p => ['high_intent','demo','negotiation','closed'].includes(p.stage))) {
    comms.push({ prospect_id: p.id, channel: 'email', direction: 'outbound', subject: `Supabase follow-up + next steps for ${p.company}`, content: `Following up after our discovery call — attaching the pricing deck and a custom demo walkthrough. Let me know when works for a 30-minute demo.`, status: 'opened' })
  }
  // Real Retell calls
  comms.push({ prospect_id: byEmail['hbenko@andrew.cmu.edu'], channel: 'call', direction: 'outbound', subject: 'Supabase Enterprise outbound call', content: `Agent: Hi, this is Bob from Supabase. I'm reaching out regarding your inquiry about Supabase Enterprise. Am I speaking with Hana Benko?\nUser: Yeah.\nAgent: I'm following up to see if you're still evaluating Supabase Enterprise for your team?\nUser: Yes.\nAgent: Got it — I can connect you with an AE for pricing and a quick demo.\nUser: That'd be great.\n[Transferred to AE]`, status: 'replied' })
  comms.push({ prospect_id: byEmail['dnarne@andrew.cmu.edu'], channel: 'call', direction: 'outbound', subject: 'Supabase Enterprise outbound call', content: `Agent: Hi, this is Bob from Supabase. Am I speaking with Dhiren Narne?\nUser: Yes. I am ready to make a deal.\nAgent: Awesome — let me connect you with an AE for a demo and custom proposal.\n[Transferred to AE]`, status: 'replied' })

  const { error: commsError } = await supabase.from('communications').insert(comms)
  if (commsError) { console.error('Comms error:', commsError.message); process.exit(1) }
  console.log(`Inserted ${comms.length} communications`)

  console.log('Seeding agent runs...')
  const runs = []
  for (const p of prospects) {
    runs.push({ prospect_id: p.id, action: 'research', reasoning: `Researching ${p.company}...`, result: { status: 'complete', score: p.score } })
    runs.push({ prospect_id: p.id, action: 'score', reasoning: `Score: ${p.score} — ${p.score >= 85 ? 'excellent fit. Strong Postgres usage, clear budget signal, decision maker identified.' : p.score >= 70 ? 'good fit. Relevant use case, some qualification needed.' : 'moderate fit. Worth a touch — may need nurturing.'}`, result: { score: p.score } })
  }
  for (const p of prospects.filter(p => ['outreach','responded','discovery_call','high_intent','demo','negotiation','closed'].includes(p.stage))) {
    runs.push({ prospect_id: p.id, action: 'email_draft', reasoning: `Drafted personalized cold email to ${p.name.split(' ')[0]} at ${p.company}`, result: { subject: `Quick question for ${p.company}`, status: 'sent' } })
  }
  for (const p of prospects.filter(p => ['responded','discovery_call','high_intent','demo','negotiation','closed'].includes(p.stage))) {
    runs.push({ prospect_id: p.id, action: 'stage_change', reasoning: `${p.name.split(' ')[0]} replied with availability — scheduling discovery call`, result: { stage: 'responded' } })
  }
  for (const p of prospects.filter(p => ['high_intent','demo','negotiation','closed'].includes(p.stage))) {
    runs.push({ prospect_id: p.id, action: 'intent_score', reasoning: `Discovery call complete. Intent: ${p.intent_score}/100. ${p.intent_score >= 70 ? 'Clear pain point, budget confirmed, decision maker engaged. Moving to high intent.' : 'Interest shown but budget unclear.'}`, result: { intent_score: p.intent_score, high_intent: p.intent_score >= 70 } })
  }
  for (const p of prospects.filter(p => ['demo','negotiation','closed'].includes(p.stage))) {
    runs.push({ prospect_id: p.id, action: 'spin_demo', reasoning: `Spinning up personalized demo for ${p.company} — focusing on Auth, Realtime, and Storage use cases`, result: { stage: 'demo' } })
  }

  const { error: runsError } = await supabase.from('agent_runs').insert(runs)
  if (runsError) { console.error('Agent runs error:', runsError.message); process.exit(1) }
  console.log(`Inserted ${runs.length} agent runs`)

  console.log('Seeding tasks...')
  const now = new Date()
  const tasks = []
  for (const p of prospects.filter(p => p.stage === 'outreach')) {
    tasks.push({ prospect_id: p.id, type: 'email', payload: { subject: `Quick question for ${p.company}`, body: `Hi ${p.name.split(' ')[0]}, reaching out from the Supabase sales team...` }, status: 'pending', scheduled_for: new Date(now.getTime() + 1 * 60 * 60 * 1000) })
  }
  for (const p of prospects.filter(p => p.stage === 'discovery_call')) {
    tasks.push({ prospect_id: p.id, type: 'discovery_call', payload: { datetime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), notes: 'Intro call — qualify budget, timeline, and use case' }, status: 'approved', scheduled_for: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) })
  }
  for (const p of prospects.filter(p => p.stage === 'demo')) {
    tasks.push({ prospect_id: p.id, type: 'demo', payload: { datetime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), demo_plan: `Show Supabase Auth, Realtime subscriptions, and Storage. Tailor to ${p.company} use case.` }, status: 'pending', scheduled_for: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) })
  }
  for (const p of prospects.filter(p => p.stage === 'negotiation')) {
    tasks.push({ prospect_id: p.id, type: 'negotiation_meeting', payload: { datetime: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(), notes: 'Review Team plan pricing, custom SLA terms, and volume discount' }, status: 'approved', scheduled_for: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000) })
  }

  const { error: tasksError } = await supabase.from('tasks').insert(tasks)
  if (tasksError) { console.error('Tasks error:', tasksError.message); process.exit(1) }
  console.log(`Inserted ${tasks.length} tasks`)

  console.log('\nDone! Database seeded with:')
  console.log(`  ${prospects.length} prospects`)
  console.log(`  ${comms.length} communications`)
  console.log(`  ${runs.length} agent runs`)
  console.log(`  ${tasks.length} tasks`)
}

seed().catch(console.error)
