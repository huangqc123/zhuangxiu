Component({
  data: {
    selected: 0,
    tabs: [
      { pagePath: '/pages/home/index', text: '首页', type: 'home' },
      { pagePath: '/pages/profile/index', text: '我的', type: 'profile' }
    ]
  },

  methods: {
    onSwitchTab(e) {
      const { index, path } = e.currentTarget.dataset
      if (Number(index) === this.data.selected) return
      wx.switchTab({ url: path })
    }
  }
})
