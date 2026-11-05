'use strict';

const orders = {
  categories: ['随笔', '前端开发', '后端开发', 'AI'],
  tags: ['随笔', '前端开发', 'JavaScript', 'AI', '后端开发', 'Go']
};

/** 展示顺序独立于 Hexo 数据库插入顺序；新增主题排在末尾，仍保留入口。 */
function orderedTopics(topics, kind) {
  const order = orders[kind];
  return [...topics.toArray()].sort((a, b) => {
    const left = order.indexOf(a.name);
    const right = order.indexOf(b.name);
    return (left < 0 ? order.length : left) - (right < 0 ? order.length : right) ||
      a.name.localeCompare(b.name, 'zh-CN');
  });
}

if (typeof hexo !== 'undefined') {
  hexo.extend.helper.register('ordered_topics', orderedTopics);
}

module.exports = orderedTopics;
