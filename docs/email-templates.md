# E-postmallar för BeGone Kundportal

## Lösenordsåterställning (Password Reset)

Använd denna HTML i Supabase Dashboard under Auth > Email Templates > Reset Password:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Återställ ditt lösenord - BeGone</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #1e293b; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #334155;">
              <h1 style="margin: 0; color: #a855f7; font-size: 28px; font-weight: 700;">BeGone Kundportal</h1>
              <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 14px;">Multisite Organisation Management</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #f1f5f9; font-size: 24px; font-weight: 600;">Återställ ditt lösenord</h2>
              
              <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hej!
              </p>
              
              <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Vi har mottagit en begäran om att återställa lösenordet för ditt konto. Klicka på knappen nedan för att sätta ett nytt lösenord:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 14px rgba(168, 85, 247, 0.4);">
                      Återställ lösenord
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 30px 0 20px 0;">
                Om knappen inte fungerar kan du kopiera och klistra in följande länk i din webbläsare:
              </p>
              
              <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0 0 30px 0; padding: 12px; background-color: #0f172a; border-radius: 6px; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
              
              <div style="padding: 20px; background-color: #1e1e2e; border-left: 4px solid #f59e0b; border-radius: 6px; margin: 30px 0;">
                <p style="color: #fbbf24; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
                  ⚠️ Säkerhetsnotis
                </p>
                <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0;">
                  Om du inte har begärt denna återställning kan du ignorera detta e-postmeddelande. Ditt lösenord kommer inte att ändras.
                </p>
              </div>
              
              <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 30px 0 0 0;">
                Länken är giltig i 1 timme av säkerhetsskäl.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0f172a; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="color: #64748b; font-size: 12px; margin: 0 0 10px 0;">
                © 2024 BeGone AB. Alla rättigheter förbehållna.
              </p>
              <p style="color: #475569; font-size: 11px; margin: 0;">
                Detta är ett automatiskt meddelande från BeGone Kundportal.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

## Inbjudan till organisation (Invite User)

Använd denna HTML i Supabase Dashboard under Auth > Email Templates > Invite User:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Välkommen till BeGone - {{ .Data.organization_name }}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #1e293b; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #334155;">
              <h1 style="margin: 0; color: #a855f7; font-size: 28px; font-weight: 700;">BeGone Kundportal</h1>
              <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 14px;">Multisite Organisation Management</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #f1f5f9; font-size: 24px; font-weight: 600;">
                Välkommen till {{ .Data.organization_name }}!
              </h2>
              
              <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hej {{ .Data.user_name }}!
              </p>
              
              <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Du har blivit inbjuden att gå med i <strong style="color: #a855f7;">{{ .Data.organization_name }}</strong> som <strong style="color: #a855f7;">{{ .Data.role_display }}</strong> i BeGone Kundportal.
              </p>
              
              <!-- Role Info Box -->
              <div style="padding: 20px; background-color: #0f172a; border-radius: 8px; margin: 0 0 30px 0;">
                <p style="color: #a855f7; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">
                  Din roll och ansvar:
                </p>
                <ul style="color: #cbd5e1; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  {{ if eq .Data.role "verksamhetschef" }}
                    <li>Full översikt över hela organisationen</li>
                    <li>Hantera alla enheter och användare</li>
                    <li>Visa rapporter och analyser</li>
                  {{ else if eq .Data.role "regionchef" }}
                    <li>Hantera enheter inom din region</li>
                    <li>Översikt över regionens prestanda</li>
                    <li>Koordinera mellan enheter</li>
                  {{ else if eq .Data.role "platsansvarig" }}
                    <li>Hantera dina tilldelade enheter</li>
                    <li>Visa och hantera ärenden</li>
                    <li>Kommunicera med tekniker</li>
                  {{ end }}
                </ul>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                      Acceptera inbjudan
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 30px 0 20px 0;">
                Om knappen inte fungerar kan du kopiera och klistra in följande länk i din webbläsare:
              </p>
              
              <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0 0 30px 0; padding: 12px; background-color: #0f172a; border-radius: 6px; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
              
              <div style="padding: 20px; background-color: #1e1e2e; border-left: 4px solid #3b82f6; border-radius: 6px; margin: 30px 0;">
                <p style="color: #60a5fa; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">
                  ℹ️ Vad händer härnäst?
                </p>
                <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0;">
                  När du accepterar inbjudan kommer du att ombedas att skapa ett lösenord för ditt konto. Därefter får du tillgång till alla funktioner som din roll tillåter.
                </p>
              </div>
              
              <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 30px 0 0 0;">
                Denna inbjudan är giltig i 7 dagar. Om du har frågor, kontakta din administratör.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #0f172a; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="color: #64748b; font-size: 12px; margin: 0 0 10px 0;">
                © 2024 BeGone AB. Alla rättigheter förbehållna.
              </p>
              <p style="color: #475569; font-size: 11px; margin: 0;">
                Detta är ett automatiskt meddelande från BeGone Kundportal.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

## Instruktioner för implementation

1. Gå till [Supabase Dashboard](https://supabase.com/dashboard)
2. Välj ditt projekt
3. Navigera till **Authentication** > **Email Templates**
4. För varje mall:
   - Välj rätt mall (Reset Password eller Invite User)
   - Klistra in HTML-koden ovan
   - Spara ändringarna

### Variabler som används:

#### Reset Password:
- `{{ .ConfirmationURL }}` - Länken för att återställa lösenordet

#### Invite User:
- `{{ .ConfirmationURL }}` - Länken för att acceptera inbjudan
- `{{ .Data.organization_name }}` - Organisationens namn
- `{{ .Data.user_name }}` - Användarens namn
- `{{ .Data.role }}` - Användarens roll (verksamhetschef, regionchef, platsansvarig)
- `{{ .Data.role_display }}` - Rollens visningsnamn

### Observera:
- Mallarna använder samma färgschema som kundportalen (mörkt tema med lila accenter)
- Responsiv design som fungerar på alla enheter
- Säkerhetsmeddelanden inkluderade
- Tydliga CTA-knappar med gradient-effekter