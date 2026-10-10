import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Auth-utrullningen (docs/sakerhetsplan-api-auth-vag2.md): alla /api-anrop
    // ska gå via apiFetch i src/lib/api.ts så att Authorization-headern aldrig
    // kan glömmas. Naken fetch('/api/…') är förbjuden i src/.
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      // Avsiktligt publika lösenordsflöden — endpointsen kräver ingen inloggning
      'src/pages/auth/ForgotPassword.tsx',
      'src/pages/auth/ResetPassword.tsx',
      'src/pages/auth/SetPassword.tsx',
      // apiFetch själv får förstås anropa fetch
      'src/lib/api.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // esquery avslutar attribut-regexet vid första snedstrecket oavsett
          // escapning — därför skrivs snedstrecken med unicode-escape (u002F)
          selector: "CallExpression[callee.name='fetch'] > Literal[value=/^\\u002Fapi\\u002F/]",
          message: "Använd apiFetch från src/lib/api.ts för /api-anrop — den bifogar Authorization-headern automatiskt.",
        },
        {
          selector: "CallExpression[callee.name='fetch'] > TemplateLiteral[quasis.0.value.raw=/^\\u002Fapi\\u002F/]",
          message: "Använd apiFetch från src/lib/api.ts för /api-anrop — den bifogar Authorization-headern automatiskt.",
        },
      ],
    },
  },
  {
    // Ikonstandard 2026-10 (docs/leads/leads-ux.md avsnitt 4, skill ui-designsystem):
    // domänbegrepp ritas som egna ikoner via <Icon>. Lucide får användas tills
    // vidare bara för generiska kontroller. Varningen gäller vyer som byggs om;
    // lägg till fler sökvägar här när en vy byggs om, byt aldrig i ett svep.
    files: [
      'src/components/icons/**/*.{ts,tsx}',
      'src/components/admin/leads/**/*.{ts,tsx}',
      'src/pages/admin/Leads*.tsx',
      'src/services/leadService.ts',
      'src/types/leads.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: 'lucide-react',
              allowImportNames: [
                'ChevronDown', 'ChevronUp', 'ChevronLeft', 'ChevronRight', 'ChevronsUpDown',
                'X', 'Plus', 'Check', 'Search', 'MoreHorizontal', 'MoreVertical',
                'RefreshCw', 'ExternalLink', 'Loader2',
              ],
              message: 'Använd <Icon> från src/components/icons (ikonstandard 2026-10). Lucide bara för generiska kontroller.',
            },
          ],
        },
      ],
    },
  },
)
