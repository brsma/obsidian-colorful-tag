import { App, Plugin, PluginSettingTab, setIcon, Setting } from 'obsidian';
import { AttributeType } from 'src/utils/attributeType';
import { css } from 'src/utils/css';
import { shadowTextPlugin } from 'src/plugin/shadowTextPlugin';
import { PerTagSetting } from 'src/setting/perTagSetting';
import { TagDetailSetting } from 'src/setting/tagDetailSetting';
import { insertCss } from 'src/utils/utils';
import { GlobalTagSetting } from 'src/setting/globalTagSetting';
import { TagDetailUtils } from 'src/tagDetail/tagDetailUtils';
import { FileTagDetail } from 'src/tagDetail/fileTagDetail';
import { Convert } from 'src/utils/dataConvert';
import { BaseTagSetting } from 'src/setting/baseTagSetting';

// Remember to rename these classes and interfaces!

interface ColorfulTagSettings {
	TagSettings: PerTagSetting[];
	GlobalTagSetting: GlobalTagSetting;
	UseTagDetail: boolean;
	StoreTagDetailInYaml: string;
	MetaFileTagDetails: Map<string, string[]> | Object;
	TagDetailData: Map<string, Array<Map<string, string | null>>> | Object;
}

export const DEFAULT_SETTINGS: ColorfulTagSettings = {
	TagSettings: new Array<PerTagSetting>(),
	GlobalTagSetting: new GlobalTagSetting(),
	UseTagDetail: false,
	StoreTagDetailInYaml: "plugin",
	TagDetailData: new Map<string, Array<Map<string, string | null>>>(),
	MetaFileTagDetails: new Map<string, string[]>()
}

export default class ColorfulTag extends Plugin {
	settings: ColorfulTagSettings;
	settingTab: ColorfulTagSettingTab;

	async onload() {
		let convert = new Convert(this);
		if (await convert.check()) {
			await convert.backup();
			await convert.convert();
		} else {
			await this.loadSettings();
		}
		let settingTab = new ColorfulTagSettingTab(this.app, this);
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.settingTab = settingTab
		this.addSettingTab(settingTab);
		this.app.workspace.on("active-leaf-change", async () => {
			await TagDetailUtils.hoverTagPopupListener(this)
		})
		this.app.metadataCache.on("changed", async (file, data, cache) => {
			await FileTagDetail.handleMetadataChange(file, data, cache, this)
		})
		this.settings.TagSettings.forEach((tag, i) => {
			tag.opened = false
		})
		await this.refresh()
		await TagDetailUtils.hoverTagPopupListener(this)
		this.registerEditorExtension(shadowTextPlugin)
	}

	onunload() {
		this.app.workspace.off("active-leaf-change", () => {
			TagDetailUtils.hoverTagPopupListener(this)
		})
		TagDetailUtils.removeListener()
	}

	async refresh() {
		let tags = this.settings.TagSettings;
		let cssTotal = css.defaultCss;
		tags.forEach((tag_) => {
			let tag = new PerTagSetting()
			Object.assign(tag, tag_)
			cssTotal += tag.generateCss(this)
		})
		insertCss(cssTotal)
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		for (let i = 0; i < this.settings.TagSettings.length; i++) {
			let tmp = new PerTagSetting()
			Object.assign(tmp, this.settings.TagSettings[i])
			tmp.opened = false
			let map = new Map<string, string | null>(Object.entries(tmp.attributes))
			tmp.attributes = map

			let tmpTagDetail = new TagDetailSetting(i)
			Object.assign(tmpTagDetail, this.settings.TagSettings[i].tagDetail)
			let mapTagDetailAttr = new Map<string, string | null>(Object.entries(tmpTagDetail.attributes))
			tmpTagDetail.attributes = mapTagDetailAttr
			let mapTagDetailType = new Map<string, [AttributeType | null, string | null]>(Object.entries(tmpTagDetail.itemType))
			tmpTagDetail.itemType = mapTagDetailType

			tmp.tagDetail = tmpTagDetail

			this.settings.TagSettings[i] = tmp
		}
		let tmp = new GlobalTagSetting()
		Object.assign(tmp, this.settings.GlobalTagSetting)
		tmp.opened = false
		let map = new Map<string, string | null>(Object.entries(tmp.attributes))
		let bmap = new Map<string, boolean>(Object.entries(tmp.enableList_))
		tmp.attributes = map
		tmp.enableList_ = bmap
		this.settings.GlobalTagSetting = tmp

		// let tmpMap = new Map<string, string[]>(Object.entries(this.settings.TagToID));
		// this.settings.TagToID = tmpMap;

		let ttmpMap = new Map<string, string[]>(Object.entries(this.settings.MetaFileTagDetails));
		this.settings.MetaFileTagDetails = ttmpMap;

		let tttmpMap = new Map<string, Array<Map<string, string | null>>>(Object.entries(this.settings.TagDetailData));
		for (let [path, tagDetail] of tttmpMap) {
			let tmpTagDetail = new Array<Map<string, string | null>>()
			for (let i = 0; i < tagDetail.length; i++) {
				let tmp = new Map<string, string | null>(Object.entries(tagDetail[i]))
				tmpTagDetail.push(tmp)
			}
			tttmpMap.set(path, tmpTagDetail)
		}
		this.settings.TagDetailData = tttmpMap;
	}

	saveSettings() {
		let tmp = []
		let tagDetailAttr = []
		let tagDetailType = []
		let globalTmp = null
		
		for (let i = 0; i < this.settings.TagSettings.length; i++) {
			tmp.push(this.settings.TagSettings[i].attributes)
			tagDetailAttr.push(this.settings.TagSettings[i].tagDetail.attributes)
			tagDetailType.push(this.settings.TagSettings[i].tagDetail.itemType)
			let obj = Object.create(null)
			let attr = this.settings.TagSettings[i].attributes as Map<string, string | null>
			for (let [k, v] of attr) {
				obj[k] = v
			}

			let objTagDetailAttr = Object.create(null)
			let attrTagDetail = this.settings.TagSettings[i].tagDetail.attributes as Map<string, string | null>
			for (let [k, v] of attrTagDetail) {
				objTagDetailAttr[k] = v
			}

			let objTagDetailType = Object.create(null)
			let typeTagDetail = this.settings.TagSettings[i].tagDetail.itemType as Map<string, [AttributeType | null, string | null]>
			for (let [k, v] of typeTagDetail) {
				objTagDetailType[k] = v
			}

			this.settings.TagSettings[i].attributes = obj
			this.settings.TagSettings[i].tagDetail.attributes = objTagDetailAttr
			this.settings.TagSettings[i].tagDetail.itemType = objTagDetailType
		}
		// global
		globalTmp = this.settings.GlobalTagSetting.attributes
		let globalBTmp = this.settings.GlobalTagSetting.enableList_
		let obj = Object.create(null)
		let attr = this.settings.GlobalTagSetting.attributes as Map<string, string | null>
		for (let [k, v] of attr) {
			obj[k] = v
		}
		let bobj = Object.create(null)
		let enableList_ = this.settings.GlobalTagSetting.enableList_ as Map<string, boolean>
		for (let [k, v] of enableList_) {
			bobj[k] = v
		}
		this.settings.GlobalTagSetting.attributes = obj
		this.settings.GlobalTagSetting.enableList_ = bobj

		// let tmpMapObj = Object.create(null)
		// let tmpMap = this.settings.TagToID as Map<string, string[]>
		// for (let [k, v] of tmpMap) {
		// 	tmpMapObj[k] = v
		// }

		let ttmp = this.settings.MetaFileTagDetails
		let ttmpMapObj = Object.create(null)
		let ttmpMap = this.settings.MetaFileTagDetails as Map<string, string[]>
		for (let [k, v] of ttmpMap) {
			ttmpMapObj[k] = v
		}
		this.settings.MetaFileTagDetails = ttmpMapObj;

		let tttmp = this.settings.TagDetailData;
		let tttmpMapObj = Object.create(null)
		let tttmpMap = this.settings.TagDetailData as Map<string, Array<Map<string, string | null>>>
		for (let [path, tagDetailData] of tttmpMap) {
			let ttttArray = []
			for (let i = 0; i < tagDetailData.length; i++) {
				let ttttobj = Object.create(null)
				let attr = tagDetailData[i] as Map<string, string | null>
				for (let [k1, v1] of attr) {
					ttttobj[k1] = v1
				}
				ttttArray.push(ttttobj)
			}
			tttmpMapObj[path] = ttttArray
		}
		this.settings.TagDetailData = tttmpMapObj;

		this.saveData(this.settings);
		
		for (let i = 0; i < this.settings.TagSettings.length; i++) {
			this.settings.TagSettings[i].attributes = tmp[i]
			this.settings.TagSettings[i].tagDetail.attributes = tagDetailAttr[i]
			this.settings.TagSettings[i].tagDetail.itemType = tagDetailType[i]
		}
		this.settings.GlobalTagSetting.attributes = globalTmp
		this.settings.GlobalTagSetting.enableList_ = globalBTmp
		this.settings.MetaFileTagDetails = ttmp;
		this.settings.TagDetailData = tttmp;
	}
}

class ColorfulTagSettingTab extends PluginSettingTab {
	plugin: ColorfulTag;

	constructor(app: App, plugin: ColorfulTag) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		let addBtn = containerEl.createEl('button', { text: "Add" });
		addBtn.onClickEvent(() => {
			let newTag = new PerTagSetting();
			newTag.opened = true
			this.plugin.settings.TagSettings.push(newTag);
			this.plugin.saveSettings();
			newTag.generateDOM(containerEl, this.plugin, this.plugin.settings.TagSettings.length-1)
		})

		let sup = new BaseTagSetting();
		let support = containerEl.createDiv("colorful-tag-setting-header is-collapsed");
		let support_header = support.createDiv();
		let support_title = sup.generateTitle(support_header, support, false);

		support_title.nameEl.createSpan().setText("Support Colorful Tag!")
		let supportBody = support.createDiv("colorful-tag-setting-body");
		supportBody.createSpan().setText("Your support will be my motivation to improve Colorful Tag. If you like this plugin, please consider to buy me a coffee. Thank you!");
		let link = supportBody.createEl("a");
		link.setAttrs({href: "https://ko-fi.com/V7V2G2MOF", target: "_blank"});
		link.createEl("img").setAttrs({
			height: "32",
			style: "border:0px;height:32px;display:block;margin:10px auto;",
			src: "https://storage.ko-fi.com/cdn/kofi2.png?v=3",
			border: "0",
			alt: "Buy Me a Coffee at ko-fi.com"
		});

		let general = containerEl.createDiv("colorful-tag-setting-header is-collapsed");
		let generalHeader = general.createDiv();
		let generalTitle = this.plugin.settings.GlobalTagSetting.generateTitle(generalHeader, general, false);
		generalTitle.nameEl.createSpan().setText("General Setting");
		let generalBody = general.createDiv("colorful-tag-setting-body");
		new Setting(generalBody).setName("Enable Tag Detail(Beta)").addToggle((cp) => {
			cp.setValue(this.plugin.settings.UseTagDetail || false)
			.onChange((v) => {
				this.plugin.settings.UseTagDetail = v;
				this.plugin.saveSettings();
				this.display();
			})
		})
		new Setting(generalBody).setName("Store Tag Detail in").addDropdown((cp) => {
			cp.addOption("yaml", "Frontmatter")
			cp.addOption("plugin", "Plugin")
			cp.setValue(this.plugin.settings.StoreTagDetailInYaml)
			.onChange((v) => {
				this.plugin.settings.StoreTagDetailInYaml = v;
				this.plugin.saveSettings();
			})
		})

		this.plugin.settings.GlobalTagSetting.generateDOM(containerEl, this.plugin)
		this.plugin.settings.TagSettings.forEach((tag, i) => {
			tag.generateDOM(containerEl, this.plugin, i)
		})
		this.plugin.refresh()
	}
}