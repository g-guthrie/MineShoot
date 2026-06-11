// We want to access navigator.userAgentData, but TypeScript does not seem to
// provide types for it by default yet, so we defined our own type.
type MyNavigator = {
  userAgentData?: {
    brands: { brand: string, version: string }[];
  };
}

const detectAndroidView = (): boolean => {
  const brands = (navigator as MyNavigator).userAgentData?.brands || [];
  return brands.some(brand => brand.brand === 'Android WebView');
};

export const maybeAndroidWebView = detectAndroidView();