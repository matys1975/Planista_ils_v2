import { useMutation } from '@tanstack/react-query';
import { fetchApi } from '../../../lib/api';

interface ResetPasswordPayload {
    userId: string;
    newPassword: string;
    scope: 'dean' | 'superadmin';
}

async function resetPassword({ userId, newPassword, scope }: ResetPasswordPayload) {
    const endpoint = scope === 'superadmin'
        ? `/superadmin/users/${userId}/reset-password`
        : `/dean/users/${userId}/reset-password`;

    return fetchApi(endpoint, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
    });
}

export function useResetPassword() {
    return useMutation({
        mutationFn: resetPassword,
    });
}
