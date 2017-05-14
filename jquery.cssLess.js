/*
 CSS Less v0.5
 Imports css and Less css (http://lesscss.org/)
 MIT license.
 https://Siderite.blogspot.com

 TODO: QUnit tests
 TODO: JsDoc comments
 TODO: implement operations and functions
 TODO: namespaces (#bundle > .button)
 TODO: parse accessors before replacing variables
 TODO: accessors (#defaults[@width], .article['color'])
 TODO: attach comments to the correct classes and rules

 */
(function($) {
	var CssClass=function(parent) {
		this.items=[];
		this.parent=parent||null;
		this.selector=null;
		this.localCachedSelectors=[];
		this.localCachedVariables=[];
		this.stripComments=false;
		this.allowNestedObjects=false;
	};

	CssClass.prototype.Render=function(renderContext) {
		var self=this;
		if (!renderContext) renderContext={
			cachedRules:{},
			variables:{}
		};
		this.localCachedSelectors.length=0;
		this.localCachedVariables.length=0;
		var sb=[];
		var rules=[];
		$.each(this.items,function() {
			switch(this.type) {
				case 'rule':
					var rule=this.value;
					if (rule.charAt(0)==='@') {
						var match=/[:\s]/.exec(rule);
						if (match) {
							var index=match.index;
							var name=rule.substring(0,index);
							var value=rule.substring(index+1);
							if (match[0]===':') {
								var previousValue=renderContext.variables[name];
								renderContext.variables[name]={
									value:value,
									regex:new RegExp(name+'\\b','ig')
								};
								self.localCachedVariables.push({
									key:name,
									previousValue:previousValue
								});
							} else {
								match=null;
							}
							// if !match then it is an unhandled directive (or a typo)
						}
					} else {
						for(var name in renderContext.variables) {
							var obj=renderContext.variables[name];
							rule=rule.replace(obj.regex,obj.value);
						}
						var rule=renderContext.cachedRules[rule]||('   '+rule+';\n');
						rules.push(rule); 
					}
				break;
				case 'comment':
					if (!this.stripComments) {
						if (this.selector) rules.push('   ');
						rules.push('/* ');
						rules.push(this.value);
						rules.push(' */\n');
					}
				break;
				case 'class':
					if (self.allowNestedObjects) {
						rules.push(this.value.Render(renderContext));
					}
				break;
			}
		});
		rules=rules.join('');
		if (this.selector) {
			sb.push(this.selector);
			sb.push(' {\n');
		}
		sb.push(rules);
		if (this.selector) {
			sb.push('}\n');
		}
		var cachedSelector='';
		var cssClass=this;
		while (cssClass.selector) {
			cachedSelector=cachedSelector
				?cssClass.selector+(cachedSelector.charAt(0)===':'?'':' ')+cachedSelector
				:cssClass.selector;
			var previousValue=renderContext.cachedRules[cachedSelector];
			renderContext.cachedRules[cachedSelector]=rules;
			self.parent.localCachedSelectors.push({
				key: cachedSelector,
				previousValue:previousValue
			});
			cssClass=cssClass.parent;
		}
		var parentSelector=this.selector;
		if (!this.allowNestedObjects) {
			$.each(this.items,function() {
				if (this.type==='class') {
					sb.push(parentSelector);
					var childRender=this.value.Render(renderContext);
					if (childRender) {
						if (childRender.charAt(0)!==':') sb.push(' ');
						sb.push(childRender);
					}
				}
			});
		}
		$.each(this.localCachedSelectors,function() {
			this.previousValue
				?renderContext.cachedRules[this.key]=this.previousValue
				:delete renderContext.cachedRules[this.key];
		});
		$.each(this.localCachedVariables,function() {
			this.previousValue
				?renderContext.variables[this.key]=this.previousValue
				:delete renderContext.variables[this.key];
		});
		return sb.join('');
	};

	var regImport=/^@import\s+["']([^"']+)["']$/i;
	CssClass.prototype.Parse = function(lessContent,doNotClear)
	{
		if (!doNotClear) {
			this.items.length=0;
			this.localCachedSelectors.length=0;
			this.localCachedVariables.length=0;
		}

		if (!lessContent) return;
		var pos=0;
		var currentClass=this;
		var comment=null;
		var sb=[];
			
		var prevChar;
		var currentChar;
		var contentLength=lessContent.length;
		for (var i=0; i<contentLength; i++) {
			var currentChar=lessContent.charAt(i);
			switch(currentChar) {
				case '{':
					if (comment) break;
					sb.push(lessContent.substring(pos,i));
					var sofar=$.trim(sb.join(''));
					var newClass=new CssClass(currentClass);
					newClass.selector=sofar;
					newClass.allowNestedObjects=sofar.charAt(0)==='@';
					currentClass.items.push({type:'class',value:newClass});
					currentClass=newClass;
					sb=[];
					pos=i+1;
					break;
				case '}':
					if (comment) break;
					sb.push(lessContent.substring(pos,i));
					var sofar=$.trim(sb.join(''));
					if (sofar) {
						currentClass.items.push({type:'rule',value:sofar});
					}
					currentClass=currentClass.parent;
					sb=[];
					pos=i+1;
					break;
				case ';':
					if (comment) break;
					sb.push(lessContent.substring(pos,i));
					var sofar=$.trim(sb.join(''));
					if (sofar.charAt(0)==='@') {
						var match=/[:\s]/.exec(sofar);
						if (!match||match[0]!==':') {
							//directives
							var match=regImport.exec(sofar);
							if (match) {
								var content=$.ajax({ type: "GET", url: match[1], async: false }).responseText;
								this.Parse(content,true);
							}
						} else {
							//variable declaration;
							currentClass.items.push({type:'rule',value:sofar});
						}
					} else {
						currentClass.items.push({type:'rule',value:sofar});
					}
					sb=[];
					pos=i+1;
					break;
				case '/':
					if (prevChar==='/') {
						if (comment) break;
						comment={type:'//',index:i+1};
						sb.push(lessContent.substring(pos,i-1));
					} else 
					if (prevChar==='*') {
						if (comment&&comment.type==='/*') {
							currentClass.items.push({type:'comment',value:lessContent.substring(comment.index,i-1)});
							pos=i+1;
							comment=null;
						}
					}
					break;
				case '*':
					if (comment) break;
					if (prevChar==='/') {
						comment={type:'/*',index:i+1};
						sb.push(lessContent.substring(pos,i-1));
					}
					break;
				case '\n':
					if (comment&&comment.type=='//') {
						currentClass.items.push({type:'comment',value:lessContent.substring(comment.index,i-1)});
						pos=i+1;
						comment=null;
					}
					break;
			}
			var prevChar=currentChar;
		}
	}


	$.interpretLess = function(lessContent,stripComments){
			var root=new CssClass();
			root.allowNestedObjects=true;
			root.stripComments=stripComments;
			root.Parse(lessContent);
			return root.Render();
	}
	$.fn.importCss = function(cssFile){
		var self=this;
		$.get(cssFile,function(data) {
			data=$.interpretLess(data);
			self.append($('<style>'+data+'</style>'));
		});
		return self;
	};
})(jQuery);