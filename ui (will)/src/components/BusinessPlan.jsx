import { useState } from 'react'

const nb = {
  card: {
    background: '#fff', border: '2px solid #09090b',
    boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
    overflow: 'hidden',
  },
  header: {
    padding: '12px 20px', borderBottom: '2px solid #09090b', background: '#f5f5f0',
    fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em',
  },
  label: {
    fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4,
  },
}

function Card({ title, children, style }) {
  return (
    <div style={{ ...nb.card, ...style }}>
      {title && <div style={nb.header}>{title}</div>}
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <div style={nb.label}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#09090b', letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#71717a', fontWeight: 500, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Tag({ children, color = '#6d28d9', bg = '#f5f3ff' }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 3,
      border: `1.5px solid ${color}`, background: bg, color,
      display: 'inline-block',
    }}>{children}</span>
  )
}

const TIERS = [
  {
    name: 'Starter',
    price: '$499',
    period: '/mo',
    color: '#52525b',
    features: [
      '1 voice agent',
      '500 call minutes/month',
      'Call recording + transcripts',
      'Basic CRM enrichment',
      'Email support',
    ],
    best: 'Early-stage companies testing AI outbound',
  },
  {
    name: 'Growth',
    price: '$1,499',
    period: '/mo',
    color: '#2563eb',
    highlight: true,
    features: [
      '3 voice agents',
      '2,000 call minutes/month',
      'Full CRM enrichment + auto-tagging',
      'Auto-summarize + stage updates',
      'Warm transfer to closers',
      'Priority support',
    ],
    best: 'Teams doing 200-500 outbound calls/month',
  },
  {
    name: 'Scale',
    price: '$3,999',
    period: '/mo',
    color: '#09090b',
    features: [
      'Unlimited voice agents',
      '8,000 call minutes/month',
      'Everything in Growth',
      'Custom interview flows',
      'Webhook integrations (HubSpot, Salesforce)',
      'Dedicated success manager',
    ],
    best: 'Sales teams replacing 2+ SDRs',
  },
]

const COMPARISONS = [
  { pain: 'SDR costs $65-85K/year fully loaded', fix: 'AI agent costs ~$0.15/min of talk time' },
  { pain: '3-6 week SDR ramp time', fix: 'Voice agent deployed in 30 minutes' },
  { pain: 'SDR makes 40-60 calls/day', fix: 'AI makes unlimited concurrent calls' },
  { pain: 'Inconsistent qualification', fix: 'Same 5-signal framework every call' },
  { pain: 'CRM notes are garbage', fix: 'Auto-enriched structured fields + tags' },
  { pain: 'After-hours leads go cold', fix: 'AI calls 24/7' },
]

const COMPETITORS = [
  { name: 'Bland AI', gap: 'No CRM, no qualification framework, just raw calling' },
  { name: 'Air AI', gap: 'Expensive, slow setup, no auto-enrichment' },
  { name: 'Synthflow', gap: 'DIY builder, no opinionated sales methodology' },
  { name: 'Human SDRs', gap: '50x more expensive, inconsistent, 9-5 only' },
]

export default function BusinessPlan() {
  const [activeSection, setActiveSection] = useState('overview')

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'problem', label: 'Problem' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'economics', label: 'Unit Economics' },
    { id: 'market', label: 'TAM SAM SOM' },
    { id: 'gtm', label: 'Go-to-Market' },
    { id: 'competitive', label: 'Competitive' },
  ]

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="mono" style={{ fontSize: 20, fontWeight: 700, color: '#09090b', margin: 0, textTransform: 'uppercase' }}>
          Business Plan
        </h1>
        <p style={{ fontSize: 12, color: '#71717a', margin: '6px 0 0', fontWeight: 500 }}>
          OpenSales — AI Sales Agent Platform
        </p>
      </div>

      {/* Section nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className="nb-btn-sm"
            style={{
              padding: '6px 14px', fontSize: 10, fontWeight: 700,
              border: '2px solid #09090b', borderRadius: 4,
              background: activeSection === s.id ? '#09090b' : '#fff',
              color: activeSection === s.id ? '#fff' : '#09090b',
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
              boxShadow: activeSection === s.id ? 'none' : '2px 2px 0 0 rgba(0,0,0,1)',
              transition: 'transform 0.05s, box-shadow 0.05s',
            }}
          >{s.label}</button>
        ))}
      </div>

      {/* ─── Overview ─── */}
      {activeSection === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="What is OpenSales">
            <div style={{ fontSize: 14, fontWeight: 600, color: '#09090b', lineHeight: 1.7, marginBottom: 16 }}>
              An AI-powered outbound sales platform that replaces the SDR function. Companies onboard via an AI interview, get a custom voice agent deployed in minutes, and the platform handles calling, qualification, CRM enrichment, and handoff to human closers.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              <Tag>AI Voice Agents</Tag>
              <Tag color="#166534" bg="#f0fdf4">Auto CRM Enrichment</Tag>
              <Tag color="#b91c1c" bg="#fef2f2">Warm Transfer</Tag>
              <Tag color="#0f766e" bg="#f0fdfa">Follow-Up Sequences</Tag>
              <Tag color="#c2410c" bg="#fff7ed">10-Tag Qualification</Tag>
            </div>

            {/* The funnel */}
            <div style={nb.label}>The Pipeline</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 8 }}>
              {[
                'Company Onboarding (7-section AI interview)',
                'Voice Agent Created (Retell)',
                'Outbound Calls Executed',
                'AI Qualifies Prospects (5 signals)',
                'CRM Auto-Enriched (tags, scores, use case)',
                'Qualified → Warm Transfer to Closer',
                'Non-Qualified → Auto Follow-Up (A/B/C)',
              ].map((step, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  borderLeft: '2px solid #09090b',
                  borderBottom: i < 6 ? 'none' : 'none',
                  marginLeft: 8,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 3, border: '2px solid #09090b',
                    background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, flexShrink: 0, marginLeft: -20,
                  }}>{i + 1}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#09090b' }}>{step}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Key Metrics at Scale (100 Customers)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
              <Stat label="MRR" value="$163K" sub="across all tiers" />
              <Stat label="ARR" value="$1.96M" />
              <Stat label="Gross Margin" value="~85%" sub="on SaaS tiers" />
              <Stat label="Infra Cost" value="$15-20K" sub="/month at 100 customers" />
            </div>
          </Card>

          <Card title="Target Market">
            <div style={{ fontSize: 13, fontWeight: 500, color: '#09090b', lineHeight: 1.7 }}>
              <strong>B2B SaaS companies</strong> (Series A+) spending $8K-$25K/month on SDRs. Sales teams of 2-10 that need more pipeline without more headcount. PLG companies with inbound leads that aren't being called fast enough.
            </div>
          </Card>
        </div>
      )}

      {/* ─── Problem ─── */}
      {activeSection === 'problem' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="Why They Buy — The Pain vs. The Fix">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '2px solid #09090b', padding: '8px 0' }}>
                <div style={{ ...nb.label, marginBottom: 0 }}>Current Pain</div>
                <div style={{ ...nb.label, marginBottom: 0 }}>OpenSales Fix</div>
              </div>
              {COMPARISONS.map((c, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
                  padding: '12px 0',
                  borderBottom: i < COMPARISONS.length - 1 ? '1px solid #e4e4e7' : 'none',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#71717a' }}>{c.pain}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#09090b' }}>{c.fix}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="The Core Insight">
            <div style={{
              fontSize: 16, fontWeight: 700, color: '#09090b', lineHeight: 1.6,
              padding: '12px 16px', border: '2px solid #09090b', borderRadius: 4,
              background: '#f5f5f0', boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
            }}>
              An AI agent that costs $500/month can outperform an SDR that costs $7,000/month — with better consistency, 24/7 availability, and structured CRM output on every single call.
            </div>
          </Card>
        </div>
      )}

      {/* ─── Pricing ─── */}
      {activeSection === 'pricing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {TIERS.map(tier => (
              <div key={tier.name} style={{
                ...nb.card,
                border: tier.highlight ? '3px solid #09090b' : '2px solid #09090b',
                boxShadow: tier.highlight ? '6px 6px 0 0 rgba(0,0,0,1)' : '4px 4px 0 0 rgba(0,0,0,1)',
              }}>
                <div style={{
                  padding: '16px 20px', borderBottom: '2px solid #09090b',
                  background: tier.highlight ? '#09090b' : '#f5f5f0',
                  color: tier.highlight ? '#fff' : '#09090b',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    {tier.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-1px' }}>{tier.price}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.7 }}>{tier.period}</span>
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {tier.features.map((f, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', flexShrink: 0, marginTop: 1 }}>+</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#09090b', lineHeight: 1.4 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: '#71717a',
                    padding: '8px 10px', background: '#f5f5f0', borderRadius: 4,
                    border: '1px solid #e4e4e7',
                  }}>
                    Best for: {tier.best}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Card title="Enterprise — Custom Pricing">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {['Unlimited everything', 'Custom LLM / fine-tuning', 'SSO + audit logs', 'SLA guarantees', 'White-label option', 'Dedicated account team'].map(f => (
                <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>+</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{f}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Commission Add-On (Optional)">
            <div style={{ fontSize: 13, fontWeight: 500, color: '#09090b', lineHeight: 1.7 }}>
              <strong>5-15% commission</strong> on closed deals sourced by OpenSales agents. Tracked via CRM tags (<code style={{ background: '#f5f5f0', padding: '2px 6px', borderRadius: 3, border: '1px solid #e4e4e7', fontSize: 11 }}>transferred-to-sales</code> → <code style={{ background: '#f5f5f0', padding: '2px 6px', borderRadius: 3, border: '1px solid #e4e4e7', fontSize: 11 }}>closed</code>). We only win when you win.
            </div>
          </Card>

          <Card title="Overage">
            <div style={{ fontSize: 13, fontWeight: 500, color: '#09090b' }}>
              <strong>$0.12/minute</strong> beyond your plan allocation (vs $0.15 Retell retail rate).
            </div>
          </Card>
        </div>
      )}

      {/* ─── Unit Economics ─── */}
      {activeSection === 'economics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="Per-Call Economics">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 20 }}>
              <Stat label="Retell Cost / Min" value="$0.07-0.10" />
              <Stat label="Our Price / Min" value="$0.12-0.19" />
              <Stat label="Gross Margin / Min" value="~55-65%" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              <Stat label="Avg Call Duration" value="2-4 min" />
              <Stat label="Cost Per Call" value="$0.20-0.40" />
              <Stat label="Bedrock / Summary" value="$0.01-0.03" />
            </div>
          </Card>

          <Card title="Cost Per Qualified Lead">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{
                padding: 16, border: '2px solid #09090b', borderRadius: 4,
                background: '#f0fdf4', boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
              }}>
                <div style={nb.label}>OpenSales</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#166534' }}>$3-8</div>
                <div style={{ fontSize: 11, color: '#71717a', fontWeight: 500, marginTop: 4 }}>at 10-20% qualification rate</div>
              </div>
              <div style={{
                padding: 16, border: '2px solid #09090b', borderRadius: 4,
                background: '#fef2f2', boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
              }}>
                <div style={nb.label}>Human SDR</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#b91c1c' }}>$150-400</div>
                <div style={{ fontSize: 11, color: '#71717a', fontWeight: 500, marginTop: 4 }}>industry average</div>
              </div>
            </div>
            <div style={{
              marginTop: 14, padding: '10px 14px', border: '2px solid #09090b',
              borderRadius: 4, background: '#f5f5f0', fontSize: 13, fontWeight: 700, color: '#09090b', textAlign: 'center',
            }}>
              20-50x cheaper per qualified lead
            </div>
          </Card>

          <Card title="Revenue Model at 100 Customers">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', borderBottom: '2px solid #09090b', padding: '8px 0' }}>
                <div style={{ ...nb.label, marginBottom: 0 }}>Tier</div>
                <div style={{ ...nb.label, marginBottom: 0 }}>Customers</div>
                <div style={{ ...nb.label, marginBottom: 0 }}>MRR</div>
              </div>
              {[
                ['Starter ($499)', '50', '$24,950'],
                ['Growth ($1,499)', '35', '$52,465'],
                ['Scale ($3,999)', '12', '$47,988'],
                ['Enterprise (custom)', '3', '$30,000'],
                ['Overage', '—', '$8,000'],
              ].map((row, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
                  padding: '10px 0',
                  borderBottom: i < 4 ? '1px solid #e4e4e7' : '2px solid #09090b',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{row[0]}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#71717a' }}>{row[1]}</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{row[2]}</div>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '12px 0' }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Total</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>100</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>$163,403</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── TAM SAM SOM ─── */}
      {activeSection === 'market' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              {
                label: 'TAM', value: '$68B', sub: 'Total Addressable Market',
                desc: 'Global outbound sales spend. ~15M SDR roles worldwide at ~$75K/year. Software replacement market for outbound sales automation.',
              },
              {
                label: 'SAM', value: '$4.2B', sub: 'Serviceable Available Market',
                desc: '280,000 B2B SaaS companies (US + EU, 10-500 employees) running outbound sales motions at an average $15K/year ACV.',
              },
              {
                label: 'SOM', value: '$12-18M', sub: 'Year 1-2 Obtainable',
                desc: '800-1,200 early-adopter companies. VC-backed SaaS, PLG with uncalled leads, teams cutting SDR costs. 1-2% penetration.',
              },
            ].map(m => (
              <div key={m.label} style={{
                ...nb.card,
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{
                  padding: '16px 20px', borderBottom: '2px solid #09090b', background: '#f5f5f0',
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#09090b', letterSpacing: '-1px' }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: '#71717a', fontWeight: 500, marginTop: 2 }}>{m.sub}</div>
                </div>
                <div style={{ padding: '14px 20px', fontSize: 12, fontWeight: 500, color: '#09090b', lineHeight: 1.6, flex: 1 }}>
                  {m.desc}
                </div>
              </div>
            ))}
          </div>

          <Card title="The Unlock">
            <div style={{
              fontSize: 14, fontWeight: 700, color: '#09090b', lineHeight: 1.6,
              padding: '12px 16px', border: '2px solid #09090b', borderRadius: 4,
              background: '#f5f5f0', boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
            }}>
              Every company that employs an SDR is a potential customer. The question isn't market size — it's speed of adoption. Once 3-5 case studies prove an AI agent at $500/mo outperforms an SDR at $7K/mo, the market comes to us.
            </div>
            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 500, color: '#71717a', lineHeight: 1.6 }}>
              The lever: if we enable agencies and resellers (white-label), SOM jumps to $30-50M because each agency partner brings 10-50 end customers.
            </div>
          </Card>
        </div>
      )}

      {/* ─── Go-to-Market ─── */}
      {activeSection === 'gtm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            {
              phase: 'Phase 1', time: 'Month 1-3', name: 'Founder-Led Sales', goal: '10 paying customers, $5K MRR',
              actions: [
                'Target 10 design partners from your network',
                'Free tier / heavy discount for case studies',
                'Iterate on onboarding flow based on feedback',
                'Nail the first 3 case studies with real ROI numbers',
              ],
            },
            {
              phase: 'Phase 2', time: 'Month 3-6', name: 'Content + Outbound', goal: '50 customers, $40K MRR',
              actions: [
                'Use OpenSales to sell OpenSales (dogfood)',
                'LinkedIn content: "We replaced our SDR with AI" case studies',
                'Cold outbound to VP Sales at Series A-C SaaS companies',
                'Launch Product Hunt / HackerNews',
              ],
            },
            {
              phase: 'Phase 3', time: 'Month 6-12', name: 'Scale', goal: '200 customers, $200K MRR',
              actions: [
                'Agency/reseller partnerships (white-label)',
                'HubSpot/Salesforce marketplace listing',
                'Self-serve onboarding (the AI interview IS the product demo)',
                'Hire first 2 AEs to work Enterprise deals',
              ],
            },
          ].map(p => (
            <Card key={p.phase} title={`${p.phase}: ${p.name} (${p.time})`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={nb.label}>Goal</div>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: '#09090b',
                  padding: '4px 12px', border: '2px solid #09090b', borderRadius: 4,
                  background: '#f5f5f0',
                }}>{p.goal}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.actions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 3, border: '2px solid #09090b',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, flexShrink: 0,
                    }}>{i + 1}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#09090b', lineHeight: 1.5 }}>{a}</div>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <Card title="Key Metrics to Track">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                ['Connect Rate', '>40%'],
                ['Qualification Rate', '15-25%'],
                ['Transfer Success', '>70%'],
                ['Cost / Qualified Lead', '<$10'],
                ['Monthly Churn', '<5%'],
                ['Time to First Call', '<1 hour'],
              ].map(([label, target]) => (
                <div key={label}>
                  <div style={nb.label}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#09090b' }}>{target}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ─── Competitive ─── */}
      {activeSection === 'competitive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="Competitive Landscape">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', borderBottom: '2px solid #09090b', padding: '8px 0' }}>
                <div style={{ ...nb.label, marginBottom: 0 }}>Competitor</div>
                <div style={{ ...nb.label, marginBottom: 0 }}>Gap We Fill</div>
              </div>
              {COMPETITORS.map((c, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16,
                  padding: '12px 0',
                  borderBottom: i < COMPETITORS.length - 1 ? '1px solid #e4e4e7' : 'none',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#09090b' }}>{c.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#71717a' }}>{c.gap}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Our Moat">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { title: 'Onboarding Speed', desc: '30-min AI interview to deployed agent. Competitors take days/weeks of manual config.' },
                { title: 'Full Stack', desc: 'Not just calling — CRM enrichment, qualification scoring, follow-up sequencing, warm transfer. One platform.' },
                { title: 'Commission Model', desc: 'Unique pay-per-performance alignment that no SaaS competitor offers. We only win when you win.' },
                { title: 'Compounding Data', desc: 'Every call makes the qualification model smarter. More calls = better qualification = more value.' },
              ].map(m => (
                <div key={m.title} style={{
                  padding: 14, border: '2px solid #09090b', borderRadius: 4,
                  boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#09090b', marginBottom: 6 }}>{m.title}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#71717a', lineHeight: 1.6 }}>{m.desc}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
