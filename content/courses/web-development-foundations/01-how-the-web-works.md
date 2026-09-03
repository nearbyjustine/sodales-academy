---
title: How the Web Works
module: Fundamentals
isPreview: true
---

## Follow one page request

When someone enters a web address, the browser needs two things: the location of the server and the page data stored there. The domain is the readable name, such as `example.com`. The Domain Name System looks up the network address connected to that name. Think of the domain as an entry in a directory, not the website itself.

The browser then sends an HTTP request to the server:

```http
GET /services HTTP/1.1
Host: example.com
```

The method is `GET`, the requested path is `/services`, and the host identifies the site. The server returns a response with a status, headers, and a body:

```http
HTTP/1.1 200 OK
Content-Type: text/html

<h1>Services</h1>
```

The browser reads that HTML and may request more files referenced by it, including style sheets, scripts, fonts, and images. Each file has its own request and response. A missing file commonly returns `404 Not Found`; a server failure may return a `500` status.

## Separate the pieces

Four services often get bundled together in conversation:

- A **registrar** records who controls a domain.
- **DNS** points that domain or subdomain toward a service.
- A **host** runs or stores the site so it can answer requests.
- The **browser** requests files, interprets them, and draws the result.

One company may sell all four, but they remain separate jobs. You can change hosting while keeping the domain, provided you update the DNS records.

## Inspect a live request

Open your browser’s developer tools, choose the Network panel, and reload a page. Select the first document request. Find its request URL, method, status, and content type. Then look at an image request and compare the content type and file size.

> A page that appears in one instant may involve dozens of exchanges. The Network panel lets you inspect each exchange instead of guessing where a failure happened.

If the HTML arrives but a style sheet fails, the page can still show content without its intended layout. That difference is a useful first clue when debugging a client site.
