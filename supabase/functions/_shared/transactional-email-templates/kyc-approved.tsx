import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MegaLotto'

interface KycApprovedProps {
  fullName?: string
  tier?: number
  dashboardUrl?: string
}

const KycApprovedEmail = ({ fullName, tier, dashboardUrl }: KycApprovedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your identity has been verified</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{fullName ? `You're verified, ${fullName}!` : `You're verified!`}</Heading>
        <Text style={text}>
          Great news — your identity verification on {SITE_NAME} has been approved{typeof tier === 'number' ? ` at Tier ${tier}` : ''}. You can now enjoy higher transaction limits.
        </Text>
        {dashboardUrl && (
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={dashboardUrl} style={button}>Go to dashboard</Button>
          </Section>
        )}
        <Text style={footer}>Thanks for helping us keep {SITE_NAME} safe.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: KycApprovedEmail,
  subject: (d: Record<string, any>) =>
    `Your identity is verified${typeof d.tier === 'number' ? ` (Tier ${d.tier})` : ''}`,
  displayName: 'KYC approved (user)',
  previewData: { fullName: 'Jane Doe', tier: 2, dashboardUrl: 'https://example.com/dashboard' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0' }
