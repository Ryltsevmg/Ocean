- radio "自定义地址" [checked]
- text: 自定义地址
- textbox "自定义地址" [invalid]:
  - /placeholder: https://npm.example.com/
  - text: invalid-registry
- alert: 请输入以 http:// 或 https:// 开头的地址
- text: 填写内网或私有 npm 源地址，以 http:// 或 https:// 开头。若为需要登录的源，请把凭据放在本机的 ~/.npmrc 里。

{
  "registry": [
    {
      "colorScheme": "light",
      "focused": {
        "outline": "none",
        "boxShadow": "rgb(23, 102, 188) 0px 0px 0px 0.5px inset",
        "borderColor": "rgb(236, 19, 19)"
      },
      "blurred": {
        "outline": "none",
        "boxShadow": "none",
        "borderColor": "rgb(236, 19, 19)"
      }
    },
    {
      "colorScheme": "dark",
      "focused": {
        "outline": "none",
        "boxShadow": "rgb(111, 179, 242) 0px 0px 0px 0.5px inset",
        "borderColor": "rgb(240, 115, 111)"
      },
      "blurred": {
        "outline": "none",
        "boxShadow": "none",
        "borderColor": "rgb(240, 115, 111)"
      }
    }
  ],
  "packageName": [
    {
      "colorScheme": "light",
      "focused": {
        "outline": "none",
        "boxShadow": "rgb(23, 102, 188) 0px 0px 0px 0.5px inset",
        "borderColor": "rgb(236, 19, 19)"
      },
      "blurred": {
        "outline": "none",
        "boxShadow": "none",
        "borderColor": "rgb(236, 19, 19)"
      }
    },
    {
      "colorScheme": "dark",
      "focused": {
        "outline": "none",
        "boxShadow": "rgb(111, 179, 242) 0px 0px 0px 0.5px inset",
        "borderColor": "rgb(240, 115, 111)"
      },
      "blurred": {
        "outline": "none",
        "boxShadow": "none",
        "borderColor": "rgb(240, 115, 111)"
      }
    }
  ]
}
