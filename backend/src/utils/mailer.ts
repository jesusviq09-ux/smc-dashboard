import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendLowStockAlert(
  part: { name: string; stock: number; minStock: number; unit: string },
  recipients: string[]
) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP no configurado — se omite el envío de email de stock bajo')
    return
  }

  const isBelow = part.stock < part.minStock
  const subject = isBelow
    ? `🔴 Stock CRÍTICO: ${part.name} por debajo del mínimo`
    : `🟡 Stock en mínimo: ${part.name}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${isBelow ? '#f85149' : '#d29922'}; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">⚠️ Alerta de inventario — SMC Dashboard</h2>
      </div>
      <div style="background: #161b22; color: #c9d1d9; padding: 24px; border: 1px solid #30363d; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px;">El repuesto <strong style="color: white;">${part.name}</strong> ${isBelow ? 'está <strong style="color: #f85149;">POR DEBAJO del mínimo</strong>' : 'ha llegado al <strong style="color: #d29922;">MÍNIMO</strong>'}.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr style="border-bottom: 1px solid #30363d;">
            <td style="padding: 8px 0; color: #8b949e;">Stock actual</td>
            <td style="padding: 8px 0; color: ${isBelow ? '#f85149' : '#d29922'}; font-weight: bold;">${part.stock} ${part.unit}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #8b949e;">Stock mínimo</td>
            <td style="padding: 8px 0; color: white; font-weight: bold;">${part.minStock} ${part.unit}</td>
          </tr>
        </table>
        <p style="color: #8b949e; font-size: 14px;">Por favor, reponga el stock lo antes posible para evitar paradas en mantenimiento.</p>
        <p style="color: #8b949e; font-size: 12px; margin-top: 24px;">Este mensaje ha sido enviado automáticamente por el SMC Dashboard.</p>
      </div>
    </div>
  `

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients.join(', '),
    subject,
    html,
  })
}
