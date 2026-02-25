const fs = require('fs');
const glob = require('glob'); // Not available? I'll just use the list.

const files = [
    "src/tenant-config/controllers/tenant-config.controller.ts",
    "src/reports/reports.controller.ts",
    "src/records/controllers/records.controller.ts",
    "src/Tenant Provisioning and Onboarding Workflow/src/tenants/controllers/tenants.controller.ts",
    "src/patients/patients.controller.ts",
    "src/Email Notification Service for Critical Access Events/notifications.controller.ts",
    "src/auth/controllers/mfa.controller.ts",
    "src/auth/controllers/auth.controller.ts",
];

files.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');

        if (!content.includes('I18nContext')) {
            content = content.replace(/(import .* from '@nestjs\/common';)/, "$1\nimport { I18nContext } from 'nestjs-i18n';");
        }

        content = content.replace(/throw new ([A-Za-z]+Exception)\('([^']+)'\)/g, (match, exception, str) => {
            const key = 'errors.' + str.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
            return `throw new ${exception}(I18nContext.current()?.t('${key}') || '${str}')`;
        });

        fs.writeFileSync(file, content);
        console.log(`Refactored ${file}`);
    }
});
