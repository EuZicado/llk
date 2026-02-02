/**
 * URL validation utilities for Pinterest board detection
 */

// Add DOM types for URL
/// <reference lib="dom" />

export interface ValidationResult {
  isValid: boolean;
  isPinterestUrl: boolean;
  boardId?: string;
  username?: string;
  errorMessage?: string;
}

/**
 * Validates if a URL is a valid Pinterest board URL
 * @param url - The URL to validate
 * @returns ValidationResult containing validation results
 */
export function validatePinterestUrl(url: string): ValidationResult {
  try {
    // Add protocol if missing
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    const parsedUrl = new URL(url);
    
    // Check if it's a Pinterest domain
    if (!parsedUrl.hostname.includes('pinterest.com')) {
      return {
        isValid: false,
        isPinterestUrl: false,
        errorMessage: 'URL must be from pinterest.com'
      };
    }

    // Parse Pinterest URL structure
    // Expected format: https://[locale.]pinterest.com/username/board-name/
    const pathParts = parsedUrl.pathname.split('/').filter((part: string) => part.length > 0);
    
    if (pathParts.length < 2) {
      return {
        isValid: false,
        isPinterestUrl: true,
        errorMessage: 'Invalid Pinterest board URL format'
      };
    }

    const username = pathParts[0];
    const boardName = pathParts[1];

    // Validate username and board name format
    if (!username || !boardName) {
      return {
        isValid: false,
        isPinterestUrl: true,
        errorMessage: 'Missing username or board name'
      };
    }

    // Check for invalid characters
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(username) || !validPattern.test(boardName)) {
      return {
        isValid: false,
        isPinterestUrl: true,
        errorMessage: 'Username or board name contains invalid characters'
      };
    }

    return {
      isValid: true,
      isPinterestUrl: true,
      boardId: `${username}/${boardName}`,
      username: username
    };

  } catch (error) {
    return {
      isValid: false,
      isPinterestUrl: false,
      errorMessage: 'Invalid URL format'
    };
  }
}

/**
 * Normalizes a Pinterest URL to ensure consistent format
 * @param url - The URL to normalize
 * @returns normalized URL string
 */
export function normalizePinterestUrl(url: string): string {
  let normalizedUrl = url.trim();
  
  // Add protocol if missing
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    
    // Ensure it ends with a slash for consistency
    if (!parsedUrl.pathname.endsWith('/')) {
      parsedUrl.pathname += '/';
    }

    // Remove trailing parameters that might interfere
    parsedUrl.search = '';
    parsedUrl.hash = '';

    return parsedUrl.toString();
  } catch {
    return normalizedUrl;
  }
}

/**
 * Checks if a Pinterest board might be private
 * @param htmlContent - HTML content to analyze
 * @returns boolean indicating if board appears to be private
 */
export function isBoardPrivate(htmlContent: string): boolean {
  const privateIndicators = [
    'board is private',
    'private board',
    'login to view',
    'sign in to see',
    'this board is private',
    'board not found',
    'page not found'
  ];

  const lowerContent = htmlContent.toLowerCase();
  return privateIndicators.some(indicator => lowerContent.includes(indicator));
}