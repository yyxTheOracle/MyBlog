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
　　最近在做宝马的一个项目，需要实现 Table 的全选 & 取消全选，原型图如下:<!-- more -->

<div align=center>
  <img src="https://r.kezaihui.com/client/image/yeyuxuan/blog-assets/20220423-1.jpg" />
</div>
<center style="color:#C0C0C0;">原型图</center>

　　然而，[antd 官网给的例子](https://ant.design/components/table-cn?theme=dark#components-table-demo-row-selection-custom)里只有在组件中的实现方法（自定义选择项——通过 `rowSelection.selections` 配置），如下图:

<div align=center>
  <img src="https://r.kezaihui.com/client/image/yeyuxuan/blog-assets/20220423-2.jpg" />
</div>
<center style="color:#C0C0C0;">antd 提供的功能</center>

　　如果想要做到原型图这样在组件外实现全选 & 取消全选，则需要更灵活地运用 `rowSelection` 这个配置项。
# Talk is cheap, show me the code!
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
　　其实最关键的地方在于 `rowSelection` 里的 `onChange` ，通常的回调函数我们不会直接调用，而在这里，如果要实现在表格外全选，则需要手动调用这个 `onChange` 。

# 2023.1.21 更新
　　最近做了个需求，需要在一个 form 中做三个字段间的联动:
![搜索反馈 form 联动](https://s3.bmp.ovh/imgs/2023/01/21/b2126d6f58801b38.gif)

　　期间遇到了`form.setFieldsValue 不会触发控件 onChange`的问题，找到了一个[解决方案](https://www.cnblogs.com/xinyouhunran/p/15578373.html)，和我这篇文章的思路挺像的，也是需要`手动触发一个回调函数`，在这里更新记录一下。

