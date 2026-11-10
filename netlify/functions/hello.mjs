export default (request) => new Response(`hello saw ${new URL(request.url).pathname}\n`);

export const config = { path: '/api/hello' };
