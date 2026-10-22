# 动效参考与采用方式

参考核对：2026-10-21。只借鉴交互原则和案例，不复制 Apple 系统代码、商标素材或界面资产；正式实现为本项目原创 CSS／WAAPI。

| 来源                                                                                                                  | 实际案例                                   | 本项目采用                                               |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| [Apple / Enhance your UI animations and transitions，WWDC24](https://developer.apple.com/videos/play/wwdc2024/10145/) | 从内容单元承接到详情的连贯缩放与可中断转换 | 资料打开、返回与阅读标题的轻量方向衔接；PDF 不做几何缩放 |
| [Apple / Animate with springs，WWDC23](https://developer.apple.com/videos/play/wwdc2023/10158/)                       | 通过弹性响应让状态变化自然连贯             | 按钮、导航与状态使用短促柔和减速；按用户选择收敛明显回弹 |
| [Apple / Designing Fluid Interfaces，WWDC18](https://developer.apple.com/videos/play/wwdc2018/803/)                   | 即时响应、空间连续性、可继续操作的流畅交互 | 新动作可中断旧动画；不等动画结束才导航、停止或取消       |
| [Apple Human Interface Guidelines / Motion](https://developer.apple.com/design/human-interface-guidelines/motion)     | 动效为理解和操作服务                       | 减少动态效果、安静阅读、状态不只用动画传递               |

100–240ms、8px、0.985 等数值是本项目制定的参数，不标注为 Apple 标准。静态晴岛的配色、插画、图标与版权来源沿用原设计档案；此次不引入第三方动效库或远程资源。
