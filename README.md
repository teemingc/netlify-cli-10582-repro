# SvelteKit repro for netlify/cli#10582

Under `netlify serve`, SvelteKit's server function answers requests that a deploy of the same files sends to the app's `_redirects` and `netlify.toml` rules. Redirects and rewrites that work on Netlify look broken locally. `netlify serve` also adds `_headers` rules to function responses, which a deploy doesn't do.

The app is the minimal template from `npx sv create` with `@sveltejs/adapter-netlify` 7.0.1. The adapter's build writes the server function to `.netlify/v1/functions/sveltekit-render.mjs` with `config.path: '/*'` and `preferStatic: true`.

| request | rule | `netlify serve` | a draft deploy |
| --- | --- | --- | --- |
| `/old` | `_redirects` 301 | 404 from SvelteKit | 301 to `/` |
| `/forced` | `_redirects` 301! | 404 from SvelteKit | 301 to `/` |
| `/toml-old` | `netlify.toml` 301 | 404 from SvelteKit | 301 to `/` |
| `/to-function` | `_redirects` rewrite to `/api/hello` | 404 from SvelteKit | 200 `hello saw /to-function` |
| `/api/hello` | function with `config.path` | 200 `hello saw /api/hello` | 200 `hello saw /api/hello` |
| `/` (SvelteKit function) | `_headers` `X-Test` | `X-Test: yes` | no `x-test` |
| `/robots.txt` (static file) | `_headers` `X-Test` | `X-Test: yes` | `x-test: yes` |

The 404s are SvelteKit's not-found page (open http://localhost:8888/old in a browser). `/api/hello` and `/robots.txt` behave the same in both and are there for comparison.

## Added to the template

- `_redirects` and `_headers`. The adapter copies them into `build/`.
- `netlify.toml`, with the build settings and the `/toml-old` redirect.
- `netlify/functions/hello.mjs`, which responds with `hello saw <path>` at `/api/hello`.
- `vite.config.js` uses `@sveltejs/adapter-netlify` instead of `@sveltejs/adapter-auto`.

## Steps

```bash
npm i
npx netlify serve --offline
```

`netlify serve` runs `vite build` (the `[build]` command) and serves the site on http://localhost:8888. In another terminal:

```bash
URL=http://localhost:8888
curl -si $URL/old | grep -Ei '^(http/|location)'
curl -si $URL/forced | grep -Ei '^(http/|location)'
curl -si $URL/toml-old | grep -Ei '^(http/|location)'
curl -si $URL/to-function | grep -Ei '^(http/|hello saw)'
curl -si $URL/api/hello | grep -Ei '^(http/|hello saw)'
curl -si $URL/ | grep -Ei '^(http/|x-test)'
curl -si $URL/robots.txt | grep -Ei '^(http/|x-test)'
```

To compare, run `npx netlify deploy --site <site ID>`. It runs the same build and creates a draft deploy. Set `URL` to the draft URL and run the curl lines again. Use the site ID: with a site name, the build step in 27.17.0 fails with "Failed retrieving site data … Not Found".

## Output

`netlify serve`:

```console
$ curl -si $URL/old | grep -Ei '^(http/|location)'
HTTP/1.1 404 Not Found
$ curl -si $URL/forced | grep -Ei '^(http/|location)'
HTTP/1.1 404 Not Found
$ curl -si $URL/toml-old | grep -Ei '^(http/|location)'
HTTP/1.1 404 Not Found
$ curl -si $URL/to-function | grep -Ei '^(http/|hello saw)'
HTTP/1.1 404 Not Found
$ curl -si $URL/api/hello | grep -Ei '^(http/|hello saw)'
HTTP/1.1 200 OK
hello saw /api/hello
$ curl -si $URL/ | grep -Ei '^(http/|x-test)'
HTTP/1.1 200 OK
X-Test: yes
$ curl -si $URL/robots.txt | grep -Ei '^(http/|x-test)'
HTTP/1.1 200 OK
X-Test: yes
```

A draft deploy (`npx netlify deploy --site <site ID>`):

```console
$ curl -si $URL/old | grep -Ei '^(http/|location)'
HTTP/2 301 
location: /
$ curl -si $URL/forced | grep -Ei '^(http/|location)'
HTTP/2 301 
location: /
$ curl -si $URL/toml-old | grep -Ei '^(http/|location)'
HTTP/2 301 
location: /
$ curl -si $URL/to-function | grep -Ei '^(http/|hello saw)'
HTTP/2 200 
hello saw /to-function
$ curl -si $URL/api/hello | grep -Ei '^(http/|hello saw)'
HTTP/2 200 
hello saw /api/hello
$ curl -si $URL/ | grep -Ei '^(http/|x-test)'
HTTP/2 200 
$ curl -si $URL/robots.txt | grep -Ei '^(http/|x-test)'
HTTP/2 200 
x-test: yes
```

## Versions

netlify-cli 27.17.0 (darwin-arm64), @sveltejs/adapter-netlify 7.0.1, @sveltejs/kit 3.2.0, svelte 5.57.3, vite 8.3.7, Node 26.13.0, npm 12.2.2, macOS 27.2.
