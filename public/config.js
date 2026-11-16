// Leave empty when the Node server also serves this site (Render, Docker, local).
// For Netlify (static site only), put your Render server URL here, e.g. 'https://smartboard-xxxx.onrender.com'
window.SB_SERVER = '';
document.write('<script src="' + window.SB_SERVER + '/socket.io/socket.io.js"><\/script>');
