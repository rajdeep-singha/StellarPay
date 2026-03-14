/**
 * API Service for communicating with the Go backend
 * Backend runs at http://localhost:8080
 */

const API_BASE_URL = "http://localhost:8080";

/**
 * Send Lumens (XLM) to a recipient using the Go backend
 * @param {string} recipient - The recipient's Stellar address
 * @param {string} amount - The amount to send (as string)
 * @returns {Promise<{message: string, hash: string}>}
 */
export async function sendLumens(recipient, amount) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": import.meta.env.VITE_API_KEY || "",
      },
      body: JSON.stringify({
        recipient,
        amount: amount.toString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error sending lumens:", error);
    throw error;
  }
}

/**
 * Check if the Go backend is running
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/send`, {
      method: "OPTIONS",
    });
    return response.ok || response.status === 405; // 405 means endpoint exists but OPTIONS not allowed
  } catch (error) {
    console.error("Backend health check failed:", error);
    return false;
  }
}

export default {
  sendLumens,
  checkBackendHealth,
  API_BASE_URL,
};

