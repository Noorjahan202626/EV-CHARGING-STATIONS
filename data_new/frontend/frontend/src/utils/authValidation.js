// src/utils/authValidation.js

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * Canonicalizes an email address.
 * For Gmail and Googlemail addresses:
 * - Convert to lowercase.
 * - Normalize domain to gmail.com.
 * - Remove everything after the first '+' in the username.
 * - Remove periods (.) from the username.
 *
 * Examples:
 *   rahul.kumar@gmail.com    -> rahulkumar@gmail.com
 *   rahulkumar+1@gmail.com   -> rahulkumar@gmail.com
 *   rahulkumar@googlemail.com-> rahulkumar@gmail.com
 *
 * For non-Gmail providers:
 * - Only trim whitespace and convert to lowercase (preserves dots and plus tags).
 */
export function canonicalizeEmail(email) {
  if (!email || typeof email !== "string") return "";
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return trimmed;

  const localPart = trimmed.slice(0, atIndex);
  let domain = trimmed.slice(atIndex + 1);

  if (GMAIL_DOMAINS.has(domain)) {
    domain = "gmail.com";
    // Strip plus alias (everything after the first '+')
    const baseLocal = localPart.split("+")[0];
    // Remove periods
    const cleanLocal = baseLocal.replace(/\./g, "");
    return `${cleanLocal}@${domain}`;
  }

  return `${localPart}@${domain}`;
}

/**
 * Validates an email address.
 * If the email domain is Gmail/Googlemail, applies strict Gmail validation rules.
 * For other providers (Outlook, Yahoo, college/company domains), applies general email validation.
 */
export function validateEmail(email) {
  if (!email || typeof email !== "string" || !email.trim()) {
    return { valid: false, error: "Email address is required." };
  }

  const clean = email.trim().toLowerCase();

  if (clean.length > 254) {
    return { valid: false, error: "Email address cannot exceed 254 characters." };
  }

  const atIndex = clean.lastIndexOf("@");
  if (atIndex <= 0 || atIndex !== clean.indexOf("@") || atIndex === clean.length - 1) {
    return { valid: false, error: "Enter a valid email address with a single '@' symbol." };
  }

  const rawLocalPart = clean.slice(0, atIndex);
  const domain = clean.slice(atIndex + 1);

  if (GMAIL_DOMAINS.has(domain)) {
    return validateGmailAddress(rawLocalPart, domain);
  }

  return validateGeneralEmailAddress(rawLocalPart, domain);
}

/**
 * Strict Gmail validation rules:
 * - Base username must contain 6–30 characters before any plus alias
 * - Only letters (a-z), numbers (0-9), and periods (.) allowed in base username
 * - Cannot start or end with a period
 * - Consecutive periods (..) not allowed
 * - Reject underscores, hyphens, and other unsupported characters in base username
 * - Optional plus alias (+tag) is allowed and does NOT count toward the 6–30 limit
 */
function validateGmailAddress(rawLocalPart, domain) {
  let baseUsername = rawLocalPart;
  let aliasTag = null;

  if (rawLocalPart.includes("+")) {
    const parts = rawLocalPart.split("+");
    baseUsername = parts[0];
    aliasTag = parts.slice(1).join("+");

    // Validate alias tag if provided
    if (!aliasTag || !/^[a-z0-9._-]+$/i.test(aliasTag)) {
      return {
        valid: false,
        error: "Invalid Gmail alias format after the '+' symbol."
      };
    }
  }

  if (baseUsername.startsWith(".")) {
    return {
      valid: false,
      error: "Gmail username cannot start with a period."
    };
  }

  if (baseUsername.endsWith(".")) {
    return {
      valid: false,
      error: "Gmail username cannot end with a period."
    };
  }

  if (baseUsername.includes("..")) {
    return {
      valid: false,
      error: "Gmail username cannot contain consecutive periods (..)."
    };
  }

  // Reject underscores, hyphens, and other unsupported characters in the base username
  if (!/^[a-z0-9.]+$/i.test(baseUsername)) {
    return {
      valid: false,
      error: "Gmail username can only contain letters (a-z), numbers (0-9), and periods (.). Underscores and hyphens are not allowed."
    };
  }

  // 6–30 characters in base username before plus alias
  if (baseUsername.length < 6 || baseUsername.length > 30) {
    return {
      valid: false,
      error: `Gmail username must be between 6 and 30 characters (currently ${baseUsername.length}).`
    };
  }

  const canonical = canonicalizeEmail(`${rawLocalPart}@${domain}`);

  return {
    valid: true,
    normalized: `${rawLocalPart}@${domain}`,
    canonical,
    provider: "gmail"
  };
}

/**
 * General email validation rules for Yahoo, Outlook, university, and company emails.
 * - Local part between 1 and 64 characters
 * - Valid local part character set
 * - Valid domain format with at least one dot and TLD of >= 2 letters
 * - No consecutive dots
 */
function validateGeneralEmailAddress(rawLocalPart, domain) {
  if (rawLocalPart.length < 1 || rawLocalPart.length > 64) {
    return {
      valid: false,
      error: "Email username must be between 1 and 64 characters."
    };
  }

  if (rawLocalPart.startsWith(".") || rawLocalPart.endsWith(".")) {
    return {
      valid: false,
      error: "Email username cannot begin or end with a period."
    };
  }

  if (rawLocalPart.includes("..") || domain.includes("..")) {
    return {
      valid: false,
      error: "Email address cannot contain consecutive periods."
    };
  }

  // General local part regex
  const generalLocalRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i;
  if (!generalLocalRegex.test(rawLocalPart)) {
    return {
      valid: false,
      error: "Email username contains invalid characters."
    };
  }

  // Domain regex requiring valid domain labels and at least a 2-letter TLD
  const domainRegex = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i;
  if (!domainRegex.test(domain)) {
    return {
      valid: false,
      error: "Enter a valid email domain (e.g., outlook.com, yahoo.com, university.edu)."
    };
  }

  const canonical = canonicalizeEmail(`${rawLocalPart}@${domain}`);

  return {
    valid: true,
    normalized: `${rawLocalPart}@${domain}`,
    canonical,
    provider: "general"
  };
}
