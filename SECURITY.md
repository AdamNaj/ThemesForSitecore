# Security

## Reporting a vulnerability

Please don't open a public issue. Report it privately through GitHub: the repository's **Security** tab, **Report a
vulnerability**. Include the version, the browser or Sitecore version, and the steps to reproduce.

The aim is to answer within a week. Once a fix is released, the report is published with credit to you, unless
you'd rather stay anonymous.

## Scope

- **The browser extension:** it runs on the Sitecore hosts you enable, injects CSS, and accepts imported themes
  (CSS files it checks before storing). Anything that lets a page, an imported theme or another site reach beyond
  that is in scope.
- **The Sitecore-deployed module** (`sitecore/`): an `httpRequestBegin` processor and static files on the Sitecore
  server. Anything that affects the server, or lets one user affect another, is in scope.

Sitecore's own vulnerabilities belong to Sitecore: report them through Sitecore's security process.

## Supported versions

Fixes go into the latest release.
