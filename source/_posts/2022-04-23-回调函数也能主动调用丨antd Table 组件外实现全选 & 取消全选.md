---
title: 回调函数也能主动调用丨antd Table 组件外实现全选 & 取消全选
tag:
  - antd
  - 前端开发
  - JavaScript
categories:
  - 前端开发
article_type: 0
no_word_count: false
no_toc: false
no_date: false
no_declare: false
no_reward: false
no_comments: false
no_share: false
no_footer: false
mathjax: false
abbrlink: d87f7e0c
date: 2022-04-23 18:54:37
top:
---

# 前言 
　　最近在做宝马的一个项目，遇到一个很常见的需求，上个图大家就懂了:

<div align=center>
  <img src="https://i.niupic.com/images/2023/01/01/aevg.jpg" />
</div>
<center style="color:#C0C0C0;">原型图</center><!-- more -->

　　然而，antd 官网给的例子里只有在组件中的实现方法（通过 `rowSelection` 配置），如下图:

<div align=center>
  <img src="https://i.niupic.com/images/2023/01/01/aeNs.jpg" />
</div>
<center style="color:#C0C0C0;">antd 提供的功能</center>

　　如果想要做到原型图这样在组件外实现全选 & 取消全选，则需要更灵活地运用 `rowSelection` 这个配置项。
# 代码实现
```jsx
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [tableData, setTableData] = useState([]);

  useEffect(() => {
    setTableData(mock); // 将 tableData 先设为表格内的全部数据
  }, []); 
  
  // 关键点：这个函数既作为回调函数，也能手动调用～
  const handleChange = (selectedRowKeys, selectedRows) => {
    setSelectedRowKeys([...selectedRowKeys]);
    setSelectedRows([...selectedRows]);
  };

  // 点击 选择全部 的回调函数
  const selectAll = () => {
    tableData.forEach((o, i) => {
      // 遍历，和全部的 tableData 作对比，找到没有勾选的 row, 将它的 key 值保存到 selectedRowKeys 数组
      if (!selectedRows.includes(o)) selectedRowKeys.push(tableData[i].account);
    });
    // 手动修改 selectedRowKeys，和 Table 组件内的 selectedRowKeys 联动
    handleChange(selectedRowKeys, [...tableData]); 
  };
  
  // 点击 取消全部 的回调函数
  const selectNone = () => {
    // 手动修改 selectedRowKeys 和 selectedRows，全部置为空
    handleChange([], []);
  };

  const rowSelection = {
    selectedRowKeys, // 受控
    type: "checkbox",
    onChange: handleChange // 将 handleChange 定义在外面，从而可以手动调用
  };

  // Table 组件，略去了无关配置
    <Table
      rowKey="account"
      columns={columns}
      dataSource={mock}
      rowSelection={rowSelection}
  />
```
# 总结
　　其实最关键的地方就是 `rowSelection` 里的 `onChange` ，通常的回调函数我们不会直接调用，而在这里，如果要实现在表格外全选，则需要手动调用这个 `onchange` 。

