function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff"
    });
    res.end(JSON.stringify(payload));
}

module.exports = { sendJson };