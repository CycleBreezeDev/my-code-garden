import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'dream-ticket-pool'

interface QueueTestProps {
  triggeredAt?: string
}

const QueueTestEmail = ({ triggeredAt }: QueueTestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Email queue test from {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Email queue test ✅</Heading>
        <Text style={text}>
          This is an automated test sent from the admin panel to confirm that the
          PGMQ-based email queue is processing messages end-to-end.
        </Text>
        <Text style={text}>
          If you received this, the queue dispatcher picked up the message and
          delivered it successfully.
        </Text>
        {triggeredAt ? (
          <Text style={meta}>Triggered at: {triggeredAt}</Text>
        ) : null}
        <Text style={footer}>{SITE_NAME} — internal diagnostic</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: QueueTestEmail,
  subject: 'Email queue test',
  displayName: 'Queue test (admin diagnostic)',
  previewData: { triggeredAt: new Date().toISOString() },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 18px',
}
const text = {
  fontSize: '14px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const meta = {
  fontSize: '12px',
  color: '#64748b',
  fontFamily: 'monospace',
  margin: '12px 0 0',
}
const footer = {
  fontSize: '12px',
  color: '#94a3b8',
  margin: '28px 0 0',
}
