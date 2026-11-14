import { projectApi } from '@/services/api';
import { apiFetch } from '@/services/http';

vi.mock('@/services/http', () => ({ API_BASE_URL: '/api/v1', apiFetch: vi.fn() }));

afterEach(() => { vi.resetAllMocks(); });

it.each([
  ['one or more experiments', 'experiments'],
  ['one or more feature flags', 'feature_flags'],
  ['server credentials', 'server_credentials'],
] as const)('retains a safe reason for %s while discarding server detail', async (suffix, reason) => {
  const detail = `Cannot delete project 'internal-uuid': referenced by ${suffix}`;
  vi.mocked(apiFetch).mockResolvedValueOnce(new Response(JSON.stringify({ detail }), { status: 409 }));
  await expect(projectApi.delete('internal-uuid')).rejects.toMatchObject({ message: 'Failed to delete project', status: 409, reason });
  expect(apiFetch).toHaveBeenCalledWith('/api/v1/projects/internal-uuid', { method: 'DELETE' });
});

it.each([
  [409, JSON.stringify({ detail: 'Project changed concurrently' })],
  [409, '<html>internal-uuid</html>'],
  [409, JSON.stringify({ detail: [{ msg: 'private database details' }] })],
  [403, JSON.stringify({ detail: "Cannot delete project 'internal-uuid': referenced by one or more experiments" })],
  [404, JSON.stringify({ detail: "Project 'internal-uuid' not found" })],
  [503, JSON.stringify({ detail: 'private database details' })],
])('uses safe fallback for status %s and unrecognized responses', async (status, body) => {
  vi.mocked(apiFetch).mockResolvedValueOnce(new Response(body, { status }));
  await expect(projectApi.delete('alpha')).rejects.toMatchObject({ message: 'Failed to delete project', status, reason: undefined });
});

it('keeps successful deletion compatible with an empty204 response', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
  await expect(projectApi.delete('alpha')).resolves.toBeUndefined();
});

it('preserves a fetch rejection for the caller to handle as an unconfirmed outcome', async () => {
  const error = new TypeError('Failed to fetch');
  vi.mocked(apiFetch).mockRejectedValueOnce(error);
  await expect(projectApi.delete('alpha')).rejects.toBe(error);
});
