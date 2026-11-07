import { Hono } from 'hono';
import { EdgeSkillResolver } from '../skills/resolver';

export const skillsRouter = new Hono();

/**
 * GET /api/v1/skills
 * List all cached/resolved edge skills
 */
skillsRouter.get('/', (c) => {
  const cached = EdgeSkillResolver.listCached();
  return c.json({
    status: 'ok',
    count: cached.length,
    skills: cached.map(s => ({
      name: s.name,
      slug: s.slug,
      source: s.source,
      cachedAt: s.cachedAt
    }))
  });
});

/**
 * POST /api/v1/skills/resolve
 * Dynamically resolve and pre-warm a skills.sh or GitHub slug on the edge
 */
skillsRouter.post('/resolve', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const slug = body.slug || body.url || body.skill;

  if (!slug) {
    return c.json({ error: 'Missing skill slug or URL in request body.' }, 400);
  }

  try {
    const resolved = await EdgeSkillResolver.resolve(slug);
    return c.json({
      status: 'ok',
      resolved: {
        name: resolved.name,
        slug: resolved.slug,
        source: resolved.source,
        instructionsPreview: resolved.instructions.substring(0, 300) + '...'
      }
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

