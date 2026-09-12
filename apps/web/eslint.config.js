import base from "../../packages/config/eslint.base.mjs";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [...base, jsxA11y.flatConfigs.recommended];
