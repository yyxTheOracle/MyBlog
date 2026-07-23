// 允许英文术语，但摘要必须至少包含一个汉字，确保中文摘要约定可被 hook 验证。
const subjectHasChinese = ({ subject }) => [
  /\p{Script=Han}/u.test(subject ?? ""),
  "subject 必须至少包含一个中文字符",
];

module.exports = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "subject-has-chinese": subjectHasChinese,
      },
    },
  ],
  rules: {
    "subject-has-chinese": [2, "always"],
    // `post` 用于区分博客文章变更与站点文档、工具链变更。
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "docs",
        "feat",
        "fix",
        "perf",
        "post",
        "refactor",
        "revert",
        "style",
        "test",
      ],
    ],
  },
};
