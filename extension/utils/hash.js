// Fact It - hashing (V0.3).
//
// Classic script; exposes FactIt.sha256Hex. Uses WebCrypto, which is
// available in content scripts, extension workers and Node.

(function (root) {
  const subtle = (root.crypto && root.crypto.subtle) || null;

  /**
   * @param {string} text
   * @returns {Promise<string>} lowercase hex SHA-256 of the UTF-8 bytes
   */
  async function sha256Hex(text) {
    if (!subtle) throw new Error("WebCrypto is not available");
    const bytes = new TextEncoder().encode(text);
    const digest = await subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  root.FactIt = Object.assign(root.FactIt || {}, { sha256Hex });
})(globalThis);
