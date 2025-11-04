export const themes = {
  light: {
    name: "Light",
    colors: {
      // Background colors
      background: "#ffffff",
      backgroundSecondary: "#f2f3f5",
      backgroundTertiary: "#e3e5e8",

      // Text colors
      textPrimary: "#060607",
      textSecondary: "#4f5660",
      textMuted: "#5c5e66",
      textLink: "#0068e0",

      // Border colors
      borderPrimary: "#d4d7dc",
      borderSecondary: "#e3e5e8",

      // Interactive colors
      hoverBackground: "#e9eaed",
      searchBackground: "#e3e5e8",

      // Message colors
      messageHoverBackground: "#f3f4f5",
      messageAuthor: "#060607",

      // Status colors
      statusOnline: "#23a559",
      statusOffline: "#747f8d",
      statusBorder: "#f2f3f5",

      // Avatar
      avatarGradientStart: "#667eea",
      avatarGradientEnd: "#764ba2",

      // Attachment colors
      attachmentBackground: "#e3e5e8",
      attachmentBorder: "#d4d7dc",
      attachmentLink: "#0068e0",

      // Error colors
      errorText: "#d83c3e",

      // Loading colors
      loadingText: "#5c5e66",

      // Scrollbar
      scrollbarThumb: "#b5b9bf",
      scrollbarTrack: "#f2f3f5",
    }
  },
  ash: {
    name: "Ash",
    colors: {
      // Background colors
      background: "#323339",
      backgroundSecondary: "#2f3136",
      backgroundTertiary: "#202225",

      // Text colors
      textPrimary: "#ffffff",
      textSecondary: "#dcddde",
      textMuted: "#8e9297",
      textLink: "#00aff4",

      // Border colors
      borderPrimary: "#44474e",
      borderSecondary: "#202225",

      // Interactive colors
      hoverBackground: "#3f4249",
      searchBackground: "#28282d",

      // Message colors
      messageHoverBackground: "#3f4249",
      messageAuthor: "#ffffff",

      // Status colors
      statusOnline: "#23a559",
      statusOffline: "#747f8d",
      statusBorder: "#2f3136",

      // Avatar
      avatarGradientStart: "#667eea",
      avatarGradientEnd: "#764ba2",

      // Attachment colors
      attachmentBackground: "#2f3136",
      attachmentBorder: "#202225",
      attachmentLink: "#00aff4",

      // Error colors
      errorText: "#ed4245",

      // Loading colors
      loadingText: "#72767d",

      // Scrollbar
      scrollbarThumb: "#818896",
      scrollbarTrack: "#323339",
    }
  },

  dark: {
    name: "Dark",
    colors: {
      // Background colors
      background: "#1a1a1e",
      backgroundSecondary: "#242429ff",
      backgroundTertiary: "#2c2c33ff",

      // Text colors
      textPrimary: "#ffffff",
      textSecondary: "#dcddde",
      textMuted: "#8e9297",
      textLink: "#00aff4",

      // Border colors
      borderPrimary: "#44474e",
      borderSecondary: "#202225",

      // Interactive colors
      hoverBackground: "#3f4249",
      searchBackground: "#28282d",

      // Message colors
      messageHoverBackground: "#232329ff",
      messageAuthor: "#ffffff",

      // Status colors
      statusOnline: "#23a559",
      statusOffline: "#747f8d",
      statusBorder: "#2f3136",

      // Avatar
      avatarGradientStart: "#667eea",
      avatarGradientEnd: "#764ba2",

      // Attachment colors
      attachmentBackground: "#2f3136",
      attachmentBorder: "#202225",
      attachmentLink: "#00aff4",

      // Error colors
      errorText: "#ed4245",

      // Loading colors
      loadingText: "#72767d",

      // Scrollbar
      scrollbarThumb: "#818896",
      scrollbarTrack: "#323339",
    }
  },

  onyx: {
    name: "Onyx",
    colors: {
      // Background colors
      background: "#070709",
      backgroundSecondary: "#101113ff",
      backgroundTertiary: "#131416",

      // Text colors
      textPrimary: "#ffffff",
      textSecondary: "#dcddde",
      textMuted: "#8e9297",
      textLink: "#00aff4",

      // Border colors
      borderPrimary: "#3e4147ff",
      borderSecondary: "#202225",

      // Interactive colors
      hoverBackground: "#3f4249",
      searchBackground: "#28282d",

      // Message colors
      messageHoverBackground: "#18181a",
      messageAuthor: "#ffffff",

      // Status colors
      statusOnline: "#23a559",
      statusOffline: "#747f8d",
      statusBorder: "#2f3136",

      // Avatar
      avatarGradientStart: "#667eea",
      avatarGradientEnd: "#764ba2",

      // Attachment colors
      attachmentBackground: "#2f3136",
      attachmentBorder: "#202225",
      attachmentLink: "#00aff4",

      // Error colors
      errorText: "#ed4245",

      // Loading colors
      loadingText: "#72767d",

      // Scrollbar
      scrollbarThumb: "#818896",
      scrollbarTrack: "#323339",
    }
  },
};

// Get saved theme from localStorage
export function getSavedTheme() {
  return localStorage.getItem('theme') || 'dark';
}

// Save theme to localStorage
export function saveTheme(themeName) {
  localStorage.setItem('theme', themeName);
}
