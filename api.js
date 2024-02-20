
this.KDF=(function(window, document, $, undefined) {

	var kdf;

	function init(arg) {
		lock();
		kdf=arg;
		if (!kdf.params) {kdf.params = {};}
		kdf.arcgissearchwidgets=[];
		kdf.rest={};
		kdf.resumed=false;
		kdf.authenticated=false;
		kdf.requestpassword=false;
		kdf.realtimeValidationOn=true;
		kdf.sessioncomplete=false;
		if (kdf.ref) {
			kdf.rest.get=kdf.restapi+'get/'+kdf.name+'/'+kdf.ref+'?locale='+kdf.locale;
			if (kdf.action) {
				api().then(form).then(get).then(content).then(fill).then(initial);
			} else {
				api().then(form).then(get).then(content).then(fill);
			}
		} else {
			if (kdf.auto) {
				if (kdf.action) {
					api().then(form).then(content).then(fill).then(initial);
				} else {
					api().then(form).then(content).then(fill);
				}
			} else {
				api().then(form).then(home);
				$('#dform_home').show();
				initRealtimeValidation('#dform_home');
				$('#dform_holder, #dform_controls').hide();
			}
		}
	}

	function ajaxSend(xhr) {
		xhr.setRequestHeader('Authorization', kdf.auth);
	}

	function ajaxError(xhr, settings, thrownError) {
		if (kdf.customerror) {
			$( '#dform_'+kdf.name ).trigger('_KDF_customError', [ kdf.customaction, xhr, settings, thrownError ] );
		} else {
			switch (xhr.status) {
				case 200: showError(kdf.messages.notallowed); break;
				case 401: showError(kdf.messages.notAuthenticated);	break;
				case 403: showError(kdf.messages.notallowed); break;
				case 423: showError(kdf.messages.locked); break;
				default: showError(kdf.messages.systemUnavailableMsg); break;
			}
		}
		unlock();
	}

	function getParams() {
		'use strict';
		var query, parms, i, pos, key, val, qsp;
		qsp={};
		query=location.search.substring(1);
		parms=query.split('&');
		for (i=parms.length-1; i>=0; i--) {
			pos=parms[i].indexOf('=');
			if (pos > 0) {
				key=parms[i].substring(0,pos);
				val=parms[i].substring(pos+1);
				qsp[key]=val;
			}
		}
		return qsp;
	}

	function checkVal(val) {
		if (val) {
			return val;
		} else {
			return '';
		}
	}


	// Rest calls

	function api() {
		if (kdf.access == 'citizen') {
			return apicitizen();
		} else {
			return apiagent();
		}
	}

	function apicitizen() {
		return $.ajax({
			url: kdf.params.token ? kdf.restapi+kdf.access+'?token='+kdf.params.token+'&preview='+kdf.preview+'&locale='+kdf.locale : kdf.restapi+kdf.access+'?preview='+kdf.preview+'&locale='+kdf.locale,
			type: 'GET', dataType: 'json', contentType: 'application/json', mimeType: 'application/json'
		}).done(function(response, status, xhr) {
			kdf.auth=xhr.getResponseHeader('Authorization');
			kdf.forms=response.forms;
			$.each(kdf.forms, function() {
				if (this.name == kdf.name) {
					kdf.rest.form=this.links[0].href.replace(/^http:\/\//i, 'https://');
					return false;
				}
			});
			kdf.profileData=response.profileData;
			kdf.authenticated=response.authenticated;
			kdf.requestpassword=!response.authenticated;
			kdf.customerset='citizen_'+response.authenticated;
		}).fail(ajaxError);
	}

	function apiagent() {
		return $.ajax({
			url: kdf.restapi+kdf.access+'?customerid='+checkVal(kdf.params.customerid)+'&interactionid='+checkVal(kdf.params.interactionid)+'&organisationid='+checkVal(kdf.params.organisationid)+'&propertyid='+checkVal(kdf.params.propertyid)+'&streetid='+checkVal(kdf.params.streetid)+'&preview='+kdf.preview+'&locale='+kdf.locale,
			type: 'GET', dataType: 'json', contentType: 'application/json', mimeType: 'application/json'
		}).done(function(response, status, xhr) {
			kdf.auth=xhr.getResponseHeader('Authorization');
			kdf.forms=response.forms;
			$.each(kdf.forms, function() {
				if (this.name == kdf.name) {
					kdf.rest.form=this.links[0].href.replace(/^http:\/\//i, 'https://');;
					return false;
				}
			});
			kdf.profileData=response.profileData;
			kdf.authenticated=true;
			kdf.requestpassword=false;
			kdf.customerset='agent_'+response.authenticated;
			if (response.closeURL) {
				$('#dform_close_agent').attr('href',response.closeURL);
			} else {
				$('#dform_close_agent').remove();
			}
		}).fail(ajaxError);
	}

	function form() {
		return $.ajax({
			url: kdf.rest.form,
			type: 'GET', dataType: 'json', contentType: 'application/json', mimeType: 'application/json',
			beforeSend: ajaxSend
		}).done(function(response, status, xhr) {
			kdf.auth=xhr.getResponseHeader('Authorization');
			hideMessages();
			resetControls();
			kdf.userforms=response.forms;
			kdf.form={
				"name": kdf.name,
				"currentpage": 1,
				"email": checkVal(kdf.params.email),
				"caseid": checkVal(kdf.params.caseid),
				"xref": checkVal(kdf.params.xref),
				"xref1": checkVal(kdf.params.xref1),
				"xref2": checkVal(kdf.params.xref2)
			}
			processLinks(response.links);
			initLaunchControls();
			listForms();
		}).fail(ajaxError);
	}

	function get() {
		return $.ajax({
			url: kdf.rest.get,
			type: 'GET', dataType: 'json', contentType: 'application/json', mimeType: 'application/json',
			beforeSend: ajaxSend
		}).done(function(response, status, xhr) {
			kdf.auth=xhr.getResponseHeader('Authorization');
			kdf.form=response;
			kdf.resumed=true;
			var displayRef = kdf.form.ref;
			if (kdf.form.caseid) {
				displayRef +='-'+kdf.form.caseid;
			}			
			$('#dform_ref_display span').html(displayRef);
			$('#dform_ref_display').show();
			processLinks(kdf.form.links);
		}).fail(ajaxError);
	}

	function getpost() {
		return $.ajax({
			url: kdf.rest.getpost,
			data: $('#dform_resume').serializeArray(),
			type: 'POST',
			beforeSend: ajaxSend
		}).done(function(response, status, xhr) {
			kdf.auth=xhr.getResponseHeader('Authorization');
			kdf.form=response;
			var displayRef = kdf.form.ref;
			if (kdf.form.caseid) {
				displayRef +='-'+kdf.form.caseid;
			}				
			$('#dform_ref_display span').html(displayRef);
			$('#dform_ref_display').show();
			kdf.requestpassword=false;
			processLinks(kdf.form.links);
		}).fail(ajaxError);
	}

	function checkSave() {
		if (!kdf.requestpassword) {
			save();
		} else {
			initRealtimeValidation('#dform_password_entry')
			$('#dform_password_entry').show();
		}
	}

	function setInteractionID(id) {
		if (!kdf.rest.setinteractionid) {
			showError(kdf.messages.notallowed)
			return;
		}
		lock();
		return $.ajax({
			url: kdf.rest.setinteractionid+'?interactionid='+id,
			type: 'POST',
			beforeSend: ajaxSend
		}).done(function(response, status, xhr) {
			kdf.auth=xhr.getResponseHeader('Authorization');
			$( '#dform_'+kdf.name ).trigger('_KDF_interactionidSet', [ kdf, id ] );
			unlock();
		}).fail(ajaxError);
	}

	function setCustomerID(id,loaddata,loadpage) {
		setObjectID('customer',id,loaddata,loadpage);
	}

	function setOrganisationID(id,loaddata,loadpage) {
		setObjectID('organisation',id,loaddata,loadpage);
	}

	function setPropertyID(id,loaddata,loadpage) {
		setObjectID('property',id,loaddata,loadpage);
	}

	function setStreetID(id,loaddata,loadpage) {
		setObjectID('street',id,loaddata,loadpage);
	}

	function setObjectID(type,id,loaddata,loadpage) {
		if (loaddata === undefined) {
			loaddata = false;
		}
		return $.ajax({
			url: kdf.rest.setobjectid+'?objecttype='+type+'&objectid='+id+'&loaddata='+loaddata,
			type: 'POST',
			beforeSend: ajaxSend
		}).done(function(response, status, xhr) {
			kdf.auth=xhr.getResponseHeader('Authorization');

			$( '#dform_'+kdf.name ).trigger('_KDF_objectidSet', [ kdf, type, id ] );

			if (loaddata) {
				if (loadpage != '') {
					loadForm(response.profileData,'','','','#dform_page_'+loadpage);
				} else {
					loadForm(response.profileData);
				}
				$( '#dform_'+kdf.name ).trigger('_KDF_objectdataLoaded', [ kdf, response.profileData, type, id ] );
			}
			if (type == 'customer') {
				setReportingIndividual(id);
			} else if (type == 'organisation') {
				setReportingOrganisation(id);
			}

		}).fail(ajaxError);
	}

	function getObjectData(type,id,loadpage) {
		return $.ajax({
			url: kdf.rest.getobjectdata+'?objecttype='+type+'&objectid='+id,
			type: 'POST',
			beforeSend: ajaxSend
		}).done(function(response, status, xhr) {
			kdf.auth=xhr.getResponseHeader('Authorization');
			if (loadpage != '') {
				loadForm(response.profileData,'','','','#dform_page_'+loadpage);
			} else {
				loadForm(response.profileData);
			}
			$( '#dform_'+kdf.name ).trigger('_KDF_objectdataLoaded', [ kdf, response.profileData, type, id ] );
		}).fail(ajaxError);
	}

	function setReportingIndividual(customerid) {
		var payload = '{ "type" : "lagan:setReportingIndividual", "data" : { "reporterId" : "' + customerid + '" } }';
		if (window.opener) {
			window.opener.postMessage(payload, '*');
		} else {
			parent.postMessage(payload, '*');
		}
	}
	
	function setReportingOrganisation(customerid) {
		var payload = '{ "type" : "lagan:setReportingOrganisation", "data" : { "reporterId" : "' + customerid + '" } }';
		if (window.opener) {
			window.opener.postMessage(payload, '*');
		} else {
			parent.postMessage(payload, '*');
		}
	}

	function save() {
		calculateActiveFields();
		kdf.form.data=$('#dform_'+kdf.name).find('.dform_field_active:not(.dform_nopersist), .dform_persist').serializeJSON({useIntKeysAsArrayIndex: true});
		if (kdf.form.currentpage == kdf.pages && checkProgress() != 0) {
			showError(kdf.messages.checkFormMsg);
			return;
		}
		kdf.saverequest={
			"name": kdf.form.name,
			"ref": checkVal(kdf.form.ref),
			"currentpage": kdf.form.currentpage,
			"password": checkVal(kdf.form.password),
			"data": kdf.form.data,
			"complete": kdf.form.currentpage == kdf.pages ? 'Y' : 'N',
			"email": checkVal(kdf.form.email),
			"caseid": checkVal(kdf.form.caseid),
			"xref": checkVal(kdf.form.xref),
			"xref1": checkVal(kdf.form.xref1),
			"xref2": checkVal(kdf.form.xref2),
			"filetokens": kdf.form.filetokens
		}
		lock();
		return $.ajax({
			url: kdf.rest.save,
			data: JSON.stringify(kdf.saverequest),
			type: 'POST', dataType: 'json', contentType: 'application/json', mimeType: 'application/json',
			beforeSend: ajaxSend
		}).done(function(response, status, xhr) {
			kdf.auth=xhr.getResponseHeader('Authorization');
			kdf.saveresponse=response;
			if (kdf.form.currentpage == kdf.pages) {
				if (kdf.saveresponse.valid) {
					
					kdf.form.ref=response.ref;
					kdf.form.caseid=response.caseid;
					kdf.form.interactionid=response.interactionid;
					
					kdf.form.complete='Y';
					$( '#dform_'+kdf.name ).trigger('_KDF_complete', [ kdf ] );					
					markComplete();
					if($('#dform_'+kdf.name).attr('data-completeaction')) {
						custom($('#dform_'+kdf.name).attr('data-completeaction'), 'complete_action', '#dform_'+kdf.name, '', false, true, true);
					}
				} else {
					kdf.form.complete='N';
					kdf.form.currentpage=1;
					gotoPage(1,false,true,true);
					$( '#dform_'+kdf.name ).trigger('_KDF_saveError', [ kdf ] );
					unlock();
					return;
				}
			}
			$('span[data-mapfrom="dform_ref"]').html(response.ref);
			$('span[data-mapfrom="dform_caseid"]').html(response.caseid);
			kdf.form.ref=response.ref;
			kdf.form.caseid=response.caseid;
			kdf.form.interactionid=response.interactionid;
			var displayRef = kdf.form.ref;
			if (kdf.form.caseid) {
				displayRef +='-'+kdf.form.caseid;
			}
			
			kdf.requestpassword=false;
			$('#dform_ref_display span').html(displayRef);
			$('#dform_ref_display').show();
			delete kdf.form.password;
			delete kdf.form.filetokens;
			$('#dform_files').html('');
			if (kdf.saveresponse.files && kdf.saveresponse.files.length > 0) {
				$.each(kdf.saveresponse.files, function() {
					var link = '<a target="_blank" href="'+kdf.restapi+'getfile?ref='+kdf.form.ref+'&filename='+encodeURIComponent(this.filename)+'">'+escapeHtml(this.filename)+'</a>';
					//TODO: this.links[0].href should be used but Spring Hateous double encoding
					$('#dform_files').append(link);
				});
				$('#dform_files').show();
			}
			if (kdf.form.complete=='Y') {
				kdf.sessioncomplete=true;
				showSuccess(kdf.messages.completedMsg + displayRef);
			} else {
				showSuccess(kdf.messages.formSavedMsg + displayRef);
			}
			if($('#dform_'+kdf.name).attr('data-saveaction')) {
				custom($('#dform_'+kdf.name).attr('data-saveaction'), 'save_action', '#dform_'+kdf.name, '', false, true, true);
			}
			$( '#dform_'+kdf.name ).trigger('_KDF_save', [ kdf ] );
			unlock();
		}).fail(ajaxError);



	}

	function download() {
		kdf.form.data=$('#dform_'+kdf.name).find('.dform_field_active:not(.dform_nopersist), .dform_persist').serializeJSON({useIntKeysAsArrayIndex: true});
		kdf.downloadrequest={
			"name": kdf.form.name,
			"ref": checkVal(kdf.form.ref),
			"data": kdf.form.data,
			"complete": kdf.form.complete,
			"email": checkVal(kdf.form.email),
			"caseid": checkVal(kdf.form.caseid),
			"xref": checkVal(kdf.form.xref),
			"xref1": checkVal(kdf.form.xref1),
			"xref2": checkVal(kdf.form.xref2)
		}
		$('#dform_download_form').attr('action',kdf.rest.download);
		$('#dform_download_form_data').val(JSON.stringify(kdf.downloadrequest));
		$('#dform_download_form').submit();
	}


	function content() {
		return $.ajax({
			url: kdf.rest.content,
			type: 'GET',
			beforeSend: ajaxSend
		}).done(function(response, status, xhr) {
			kdf.auth=xhr.getResponseHeader('Authorization');
			hideMessages();
			$('#dform_holder').html(response);
			$('#dform_holder div[data-type="html"]:contains("[")').html(function(index,html){
				return html.replace(/\[([^\]]+)\]/g, '<span data-mapfrom="$1"></span>');
			});
			$('div[data-type="page"][data-active="false"]').addClass('dform_hidden');
		});
	}


	function initial() {
		return custom(kdf.action, 'initial', '#dform_'+kdf.name, '', false, true, true);

	}

	function custom(action, actionedby, selector, required, validate, loadform, lockform) {

		var selectorids = '';
		var requiredids = '';

		if (selector)
			selectorids = selector.split(',').map(function(n, i){ if(n.indexOf('#') == 0 || n.indexOf('.') == 0) return n; else return '.dform_widget_' + n.trim(); }).join(',');
		if (required)
			requiredids = required.split(',').map(function(n, i){ if(n.indexOf('#') == 0 || n.indexOf('.') == 0) return n; else	return '.dform_widget_' + n.trim(); }).join(',');

		if (lockform) {
			lock();
		}

		if ((selectorids || requiredids) && validate) {
			if (checkCustom(selectorids, requiredids) != 0) {
				unlock();
				return;
			}
		}

		var data = $(selectorids).find('input, select, textarea').serializeJSON({useAlias: true, useIntKeysAsArrayIndex: true});

		kdf.customerror=true;
		kdf.customaction=action;

		kdf.customrequest={
			"name": kdf.form.name,
			"data": data,
			"email": kdf.form.email,
			"caseid": kdf.form.caseid,
			"xref": kdf.form.xref,
			"xref1": kdf.form.xref1,
			"xref2": kdf.form.xref2
		}

		return $.ajax({
			url: kdf.rest.custom+'?action='+action+'&actionedby='+actionedby+'&loadform='+loadform+'&access='+kdf.access+'&locale='+kdf.locale,
			data: JSON.stringify(kdf.customrequest),
			type: 'POST', dataType: 'json',	contentType: 'application/json', mimeType: 'application/json',
			beforeSend: ajaxSend
		}).done(function(response, status, xhr) {
			kdf.auth=xhr.getResponseHeader('Authorization');
			kdf.customerror=false;
			kdf.customresponse=response;
			if (response.loadform) {
				loadForm(response.data);
			}
			if (lockform) {
				unlock();
			}

			processLogicButton($('#'+actionedby));

			$( '#dform_'+kdf.name ).trigger('_KDF_custom', [ kdf, response, action ] );
		}).fail(ajaxError);
	}

	function customdata(action, actionedby, loadform, lockform, data) {
		if (lockform) {
			lock();
		}

		kdf.customerror=true;
		kdf.customaction=action;

		kdf.customrequest={
			"name": kdf.form.name,
			"data": data,
			"email": kdf.form.email,
			"caseid": kdf.form.caseid,
			"xref": kdf.form.xref,
			"xref1": kdf.form.xref1,
			"xref2": kdf.form.xref2
		}

		return $.ajax({
			url: kdf.rest.custom+'?action='+action+'&actionedby='+actionedby+'&loadform='+loadform+'&access='+kdf.access+'&locale='+kdf.locale,
			data: JSON.stringify(kdf.customrequest),
			type: 'POST', dataType: 'json',	contentType: 'application/json', mimeType: 'application/json',
			beforeSend: ajaxSend
		}).done(function(response, status, xhr) {
			kdf.auth=xhr.getResponseHeader('Authorization');
			kdf.customerror=false;
			kdf.customresponse=response;
			if (response.loadform) {
				loadForm(response.data);
			}
			if (lockform) {
				unlock();
			}
			$( '#dform_'+kdf.name ).trigger('_KDF_custom', [ kdf, response, action ] );
		}).fail(ajaxError);
	}

	function searchwidget(action, name) {
		if (checkCustom('#dform_widget_'+name+'_searchholder .dform_widget_searchfield', '#dform_widget_'+name+'_searchholder div[data-required="true"]') != 0) {
			return;
		}

		var data = $('#dform_widget_'+name+'_searchholder input').serializeJSON({useAlias: true, useIntKeysAsArrayIndex: true});

		kdf.widgetaction=action;

		kdf.customrequest={
			"name": kdf.form.name,
			"data": data,
			"email": kdf.form.email,
			"caseid": kdf.form.caseid,
			"xref": kdf.form.xref,
			"xref1": kdf.form.xref1,
			"xref2": kdf.form.xref2
		}

		lock();

		return $.ajax({
			url: kdf.rest.widget+'?action='+action+'&actionedby='+name+'&loadform=true&access='+kdf.access+'&locale='+kdf.locale,
			data: JSON.stringify(kdf.customrequest),
			type: 'POST', dataType: 'json',	contentType: 'application/json', mimeType: 'application/json',
			beforeSend: ajaxSend
		}).done(function(response, status, xhr) {
			kdf.auth=xhr.getResponseHeader('Authorization');
			kdf.widgetresponse=response;

			if (response.data.length > 0) {
				loadWidget(name+'_resultholder',response.data,'','','');
			}
			$('#dform_widget_'+name+'_resultholder').show();
			$('#dform_widget_'+name+'_searchholder').hide();

			unlock();

			$('#dform_widget_'+name+'_id').unbind('change').change(function() {
				$('#dform_widget_'+name+'_desc').val($('#'+$(this).attr('id')+ ' option:selected').text());

				$('#dform_widget_'+name+'_searchcontainer').removeClass('dform_widgeterror');
				$('#dform_widget_'+name+'_searchcontainer').siblings('.dform_validationMessage').hide();

				if ($(this).data('setid')) {
					setObjectID($(this).data('type'),$(this).val(),$(this).data('loaddata'),$(this).data('loadpage'));
				} else if ($(this).data('loaddata')) {
					getObjectData($(this).data('type'),$(this).val(),$(this).data('loadpage'));
				}
			});

			$('#dform_widget_'+name+'_resultholder .dform_widget_search_closeresults').unbind('click').click(function(){
				$('#dform_widget_'+name+'_searchholder').show();
				$('#dform_widget_'+name+'_resultholder').hide();
				$('#dform_widget_'+name+'_id').empty();
				$('#dform_widget_'+name+'_desc').val('');
			});
			$( '#dform_'+kdf.name ).trigger('_KDF_search', [ kdf, response, action, name ] );
		}).fail(ajaxError);
	}

	function checkSearchWidget(wigetHolder){
		$(wigetHolder).removeClass('dform_widgeterror');
		$(wigetHolder).parent().siblings('.dform_validationMessage').hide();

		if ($(wigetHolder).parent().hasClass('dform_hidden'))
			return true;

		var field = $(wigetHolder).attr('data-field');
		var required = $(wigetHolder).attr('data-required');

		if (required == 'true' && ($('#'+field).val() == '' || !$('#'+field).val())) {
			$(wigetHolder).addClass('dform_widgeterror');
			$(wigetHolder).find('.dform_validationMessage:first').show();
			return false;
		}
		return true;
	}



	// Files

	function initFileUpload(selector) {
		$(selector).find('input[type="file"]').each(function() {

			var fileinputid=$(this).attr('id');
			//OFORMS-113 - don't remove the dform_widget_ identifier from the field name to permit reloading of child page file widgets
			//var fieldname=$(this).attr('id').replace('dform_widget_','');
			var fieldname=$(this).attr('id');
			var maxsize=$(this).data('maxsize');
			$('#'+fileinputid+'_progressbar').html('<div style="width: '+0+'%;"></div>');

			$(this).fileupload({
				dataType: 'json',
				url: kdf.rest.attachFiles+'?ref='+checkVal(kdf.form.ref)+'&field='+fieldname+'&locale='+kdf.locale,
				beforeSend: ajaxSend,
				add: function(e, data) {
					clearFieldError(this, false);
					var existingFiles=[];
					var uploadErrors=[];
					var validExtensions=[];
					if ($(this).attr('accept')) {validExtensions = $(this).attr('accept').split(',');}
					$(this).parent().find('.dform_error').remove();
					$('.dform_filenames span').each(function() {
						var elemhtml = $(this).html();
						existingFiles.push(elemhtml.substring(0, elemhtml.indexOf('<')));
					});
					
					$.each(data.originalFiles, function() {
						if (maxsize != 0 && this.size > maxsize) {
							uploadErrors.push(kdf.messages.incorrectFileSizeMsg+' '+this.name);
						}
						
						var matchString = this.name.toLowerCase();
						var rslt = null;
						$.each(existingFiles, function(index, value) {
							if (rslt == null && value.toLowerCase() === matchString) {
								uploadErrors.push(kdf.messages.fileExistsMsg+' '+this.name);
								rslt = index;
								return false;
							}
						});
						
						if (validExtensions.length > 0 && $.inArray(this.name.substring(this.name.lastIndexOf('.')), validExtensions) < 0) {
							uploadErrors.push(kdf.messages.incorrectFileTypeMsg+' '+$('#'+fileinputid).attr('accept'));
						}
					});

					if (uploadErrors.length > 0) {
						showFieldError(this, false);
						showWarning(uploadErrors);
					} else {
						hideMessages();
						data.submit();
					}
				},
				fail : function(e, data) {				
					showFieldError(this, false);
					if(data.errorThrown == 'Unprocessable Entity') {
						showWarning(kdf.messages.htmlInName);
					} else {
						showWarning(kdf.messages.fileInfected);
					}
				},
				done: function (e, data) {
					kdf.auth=data.xhr().getResponseHeader('Authorization');
					$.each(data.result, function (index, file) {
						var fileitem = $('<span>');
						fileitem.attr('data-filename', this.filename);
						fileitem.attr('data-token', this.token);
						fileitem.attr('data-ref', kdf.form.ref);
						fileitem.append(escapeHtml(this.filename) + '<span class="file_delete">4</span>');
						fileitem.appendTo('#' + fileinputid + '_files');

						if (!kdf.form.filetokens) {
							kdf.form.filetokens = [];
						}

						if (file.token) {
							kdf.form.filetokens.push(file.token);
						}
					});
					setTimeout(function() {
						$('#'+fileinputid+'_progressbar').html('<div style="width: '+0+'%;"></div>');
					}, 1500);
				},
				progress: function (e, data) {
					var progress=parseInt(data.loaded / data.total * 100, 10);
					$('#'+fileinputid+'_progressbar').html('<div style="width: '+progress+'%;"></div>');
				}
			}).prop('disabled', !$.support.fileInput).parent().addClass($.support.fileInput ? undefined : 'disabled');
		});

		$(selector).off('click', '.dform_filenames > span > span').on('click', '.dform_filenames > span > span', function(event) {
			event.preventDefault();

			if (kdf.form.complete == 'Y') {
				return;
			}

			var container = $(this).parent();
			var filetoken =container.data('token');
			var fileref = container.data('ref');
			var filename = container.data('filename');

			if (kdf.form.ref) {
				$.ajax({
					url: kdf.rest.deleteFile + '?ref=' + fileref + '&filename=' + filename,
					type: 'POST',
					beforeSend: ajaxSend
				}).done(function(response, status, xhr) {

					kdf.auth=xhr.getResponseHeader('Authorization');

					if (kdf.form.filetokens) {
						kdf.form.filetokens.splice(kdf.form.filetokens.indexOf(filetoken), 1);
					}
					container.remove();
				}).fail(ajaxError);

			} else if (filetoken) {
				if (kdf.form.filetokens) {
					kdf.form.filetokens.splice(kdf.form.filetokens.indexOf(filetoken), 1);
				}
				container.remove();
				
			} else {
				container.remove();
			}

		});
	}


	// GIS

	function initialiseGIS(mapHolder) {

		if (!$(mapHolder).is(':visible') || $(mapHolder).attr('data-mapready'))
			return;
		$(mapHolder).attr('data-mapready',true);

		var id = $(mapHolder).attr('id');
		var maptype = $(mapHolder).attr('data-maptype');

		var lat = Number($('#'+id+'_lat').val());
		var lon = Number($('#'+id+'_lon').val());

		if (isNaN(lat)) {lat = 0;}
		if (isNaN(lon)) {lon = 0;}

		if (maptype != 'arcgis') {
			initialiseGoogleMap(id,mapHolder,lat,lon);
		} else {
			initialiseArcGISMap(id,mapHolder,lat,lon);
		}
	}

	function initialiseGoogleMap(id,mapHolder,lat,lon) {
		var marker;

		var centerlat = Number($(mapHolder).attr('data-centerlat'));
		var centerlon = Number($(mapHolder).attr('data-centerlon'));
		var zoomlevel = Number($(mapHolder).attr('data-zoomlevel'));
		var minzoom = Number($(mapHolder).attr('data-minzoom'));
		var maxzoom = Number($(mapHolder).attr('data-maxzoom'));
		var projection = $(mapHolder).attr('data-projection');
		var customaction = $(mapHolder).attr('data-customaction');
		var search = Boolean($(mapHolder).attr('data-search') == 'true');
		var centeronlocation = Boolean($(mapHolder).attr('data-centeronlocation') == 'true');
		var name = $(mapHolder).attr('data-name');
		var map;
		var reversegeocode = Boolean($(mapHolder).attr('data-reversegeocode') == 'true');
		var reversegeocodeaction = $(mapHolder).attr('data-reversegeocodeaction');
		var reversegeocodesetid = Boolean($(mapHolder).attr('data-reversegeocodesetid') == 'true');;
		var reversegeocodeobjecttype = $(mapHolder).attr('data-reversegeocodeobjecttype');
		var reversegeocodeloaddata =  Boolean($(mapHolder).attr('data-reversegeocodeloaddata') == 'true');;
		var reversegeocodeloadpage = $(mapHolder).attr('data-reversegeocodeloadpage');

		if (reversegeocode) {
			displayReverseGeocode(id);
		}

		if (lat != 0 && lon != 0) {
			if (projection) {
				var centerlatLng = proj4(projection,proj4('EPSG:4326'),[lat, lon]);
				lat = centerlatLng[1];
				lon = centerlatLng[0];
			}
			if (minzoom != 0 && maxzoom != 0) {
				map = new google.maps.Map(mapHolder, {center: {lat: lat, lng: lon},zoom: zoomlevel,minZoom: minzoom, maxZoom: maxzoom});
			} else if (minzoom != 0) {
				map = new google.maps.Map(mapHolder, {center: {lat: lat, lng: lon},zoom: zoomlevel,minZoom: minzoom});
			} else if (maxzoom != 0) {
				map = new google.maps.Map(mapHolder, {center: {lat: lat, lng: lon},zoom: zoomlevel,maxZoom: maxzoom});
			} else {
				map = new google.maps.Map(mapHolder, {center: {lat: lat, lng: lon},zoom: zoomlevel});
			}
			marker = new google.maps.Marker({position: new google.maps.LatLng(lat,lon),map: map});
			marker.setZIndex(2);
		} else {
			if (minzoom != 0 && maxzoom != 0) {
				map = new google.maps.Map(mapHolder, {center: {lat: centerlat, lng: centerlon},zoom: zoomlevel,minZoom: minzoom, maxZoom: maxzoom});
			} else if (minzoom != 0) {
				map = new google.maps.Map(mapHolder, {center: {lat: centerlat, lng: centerlon},zoom: zoomlevel,minZoom: minzoom});
			} else if (maxzoom != 0) {
				map = new google.maps.Map(mapHolder, {center: {lat: centerlat, lng: centerlon},zoom: zoomlevel,maxZoom: maxzoom});
			} else {
				map = new google.maps.Map(mapHolder, {center: {lat: centerlat, lng: centerlon},zoom: zoomlevel});
			}
			if (centeronlocation && navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(function(position) {
					map.setCenter(new google.maps.LatLng(position.coords.latitude,position.coords.longitude));
				});
			}
		}

		google.maps.event.addListener(map, 'click', function(event) {
			if (!kdf.form.readonly) {
				if (marker) marker.setMap(null);
				marker = new google.maps.Marker({position: event.latLng, map: map});
				marker.setZIndex(2);
				if (projection) {
					var latLng = proj4(proj4('EPSG:4326'),projection,[event.latLng.lng(),event.latLng.lat()]);
					$('#'+id+'_lat').val(latLng[0]);
					$('#'+id+'_lon').val(latLng[1]);
					$('#dform_'+kdf.name).trigger('_KDF_mapClicked', [ kdf, 'google', name, map, null, null, marker, event.latLng.lng(), event.latLng.lat(), latLng[1], latLng[0] ] );
				} else {
					$('#'+id+'_lat').val(event.latLng.lat());
					$('#'+id+'_lon').val(event.latLng.lng());
					$('#dform_'+kdf.name).trigger('_KDF_mapClicked', [ kdf, 'google', name, map, null, null, marker, event.latLng.lng(), event.latLng.lat(), null, null ] );
				}
				$(mapHolder).removeClass('dform_maperror');
				$(mapHolder).siblings('.dform_validationMessage').hide();
				if (reversegeocode) {
					reverseGeocode(id,reversegeocodeaction,reversegeocodesetid,reversegeocodeobjecttype,reversegeocodeloaddata,reversegeocodeloadpage);
				}
			}
		});

		google.maps.event.addListener(map, 'tilesloaded', function(evt){
			$(this.getDiv()).find("img").each(function(i, eimg){
				if(!eimg.alt || eimg.alt ===''){
					eimg.alt = "Google Maps Image";
				}
			});
		});

		if (search) {
			initialiseGoogleSearch(mapHolder,map);
		}
		if (customaction) {
			initialiseGISCaseLayer(map,customaction,id,projection,'google');
		}
		$('#dform_'+kdf.name).trigger('_KDF_mapReady', [ kdf, 'google', name, map, null, null, marker, projection ] );
		return map;
	}

	function initialiseGoogleSearch(mapHolder,map) {

		var id = $(mapHolder).attr('id');

		// Create the search box and link it to the UI element.
		$(mapHolder).append('<div style="display:none;"><input type="text" id="'+id+'_gis_search" name="'+id+'_gis_search" class="dform_gis_search dform_ignore" title="'+kdf.messages.gisquery+'" placeholder="'+kdf.messages.gisquery+'"/></div>');
		var input = document.getElementById(id+'_gis_search');
		var searchBox = new google.maps.places.SearchBox(input);
		map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

		// Bias the SearchBox results towards current map's viewport.
		map.addListener('bounds_changed', function() {
			searchBox.setBounds(map.getBounds());
		});

		var markers = [];
		// Listen for the event fired when the user selects a prediction and retrieve
		// more details for that place.
		searchBox.addListener('places_changed', function() {
			var places = searchBox.getPlaces();

			if (places.length == 0) {
				return;
			}

			// Clear out the old markers.
			markers.forEach(function(marker) {
				marker.setMap(null);
			});
			markers = [];

			// For each place, get the icon, name and location.
			var bounds = new google.maps.LatLngBounds();
			places.forEach(function(place) {
				var icon = {
					url: place.icon,
					size: new google.maps.Size(71, 71),
					origin: new google.maps.Point(0, 0),
					anchor: new google.maps.Point(17, 34),
					scaledSize: new google.maps.Size(25, 25)
				};

				// Create a marker for each place.
				markers.push(new google.maps.Marker({
					map: map,
					icon: icon,
					title: place.name,
					position: place.geometry.location
				}));

				if (place.geometry.viewport) {
					// Only geocodes have viewport.
					bounds.union(place.geometry.viewport);
				} else {
					bounds.extend(place.geometry.location);
				}
			});
			map.fitBounds(bounds);
		});
	}

	function initialiseArcGISMap(id,mapHolder,lat,lon) {
		var centerlat = Number($(mapHolder).attr('data-centerlat'));
		var centerlon = Number($(mapHolder).attr('data-centerlon'));
		var zoomlevel = Number($(mapHolder).attr('data-zoomlevel'));
		var minzoom = Number($(mapHolder).attr('data-minzoom'));
		var maxzoom = Number($(mapHolder).attr('data-maxzoom'));
		var projection = $(mapHolder).attr('data-projection');
		var customaction = $(mapHolder).attr('data-customaction');
		var search = Boolean($(mapHolder).attr('data-search') == 'true');
		var centeronlocation = Boolean($(mapHolder).attr('data-centeronlocation') == 'true');
		var name = $(mapHolder).attr('data-name');
		var reversegeocode = Boolean($(mapHolder).attr('data-reversegeocode') == 'true');
		var reversegeocodeaction = $(mapHolder).attr('data-reversegeocodeaction');
		var reversegeocodesetid = Boolean($(mapHolder).attr('data-reversegeocodesetid') == 'true');;
		var reversegeocodeobjecttype = $(mapHolder).attr('data-reversegeocodeobjecttype');
		var reversegeocodeloaddata =  Boolean($(mapHolder).attr('data-reversegeocodeloaddata') == 'true');;
		var reversegeocodeloadpage = $(mapHolder).attr('data-reversegeocodeloadpage');

		var url = $(mapHolder).attr('data-url');
		var layertype = $(mapHolder).attr('data-layertype');
		var geometryserviceurl = $(mapHolder).attr('data-geometryserviceurl');
		var locatorurl = $(mapHolder).attr('data-locatorurl');
		var singlelinefieldname = $(mapHolder).attr('data-singlelinefieldname');
		var outfields = $(mapHolder).attr('data-outfields');
		var enablesuggestions = Boolean($(mapHolder).attr('data-enablesuggestions') == 'true');
		var geocodeonline = Boolean($(mapHolder).attr('data-geocodeonline') == 'true');
		var wkid = Number($(mapHolder).attr('data-wkid'));
		
		var searchextent = Boolean($(mapHolder).attr('data-searchextent') == 'true');
		var minx = Number($(mapHolder).attr('data-minx'));
		var miny = Number($(mapHolder).attr('data-miny'));
		var maxx = Number($(mapHolder).attr('data-maxx'));
		var maxy = Number($(mapHolder).attr('data-maxy'));

        require(["esri/map", "esri/geometry/Point", "esri/symbols/SimpleMarkerSymbol", "esri/symbols/PictureMarkerSymbol", "esri/graphic",  "esri/layers/GraphicsLayer", "esri/dijit/Search", "esri/geometry/Extent", "esri/tasks/locator", "esri/config", "dojo/domReady!" ],
        function(Map, Point, SimpleMarkerSymbol, PictureMarkerSymbol, Graphic, GraphicsLayer, Search, Extent, Locator, esriConfig) {

			if (geometryserviceurl != '') {
				esriConfig.defaults.geometryService = geometryserviceurl;
			}

			var markerSymbol = new PictureMarkerSymbol('/dformresources/content/map-pin.png', 22, 40);
			markerSymbol.setOffset(0, 20);
			var marker,map;
			var baseMapLayer
			if (layertype == 'dynamic') {
				baseMapLayer = new esri.layers.ArcGISDynamicMapServiceLayer(url);
			} else {
				baseMapLayer = new esri.layers.ArcGISTiledMapServiceLayer(url);
			}
			var positionLayer = new GraphicsLayer();
			var markerLayer = new GraphicsLayer();

			if (reversegeocode) {
				displayReverseGeocode(id);
			}

			if (lat != 0 && lon != 0) {
				var point = new Point(lon, lat, new esri.SpatialReference({ wkid: wkid }));
				if (minzoom != 0 && maxzoom != 0) {
					map = new Map(mapHolder, {center: point,zoom: zoomlevel,minZoom: minzoom,maxZoom: maxzoom});
				} else if (minzoom != 0) {
					map = new Map(mapHolder, {center: point,zoom: zoomlevel,minZoom: minzoom});
				} else if (maxzoom != 0) {
					map = new Map(mapHolder, {center: point,zoom: zoomlevel,maxZoom: maxzoom});
				} else {
					map = new Map(mapHolder, {center: point,zoom: zoomlevel});
				}
				marker = new Graphic(point, markerSymbol);
				positionLayer.clear();
				positionLayer.add(marker);
			} else {
				var center = new Point(centerlon, centerlat, new esri.SpatialReference({ wkid: wkid }));
				if (minzoom != 0 && maxzoom != 0) {
					map = new Map(mapHolder, {center: center,zoom: zoomlevel,minZoom: minzoom,maxZoom: maxzoom});
				} else if (minzoom != 0) {
					map = new Map(mapHolder, {center: center,zoom: zoomlevel,minZoom: minzoom});
				} else if (maxzoom != 0) {
					map = new Map(mapHolder, {center: center,zoom: zoomlevel,maxZoom: maxzoom});
				} else {
					map = new Map(mapHolder, {center: center,zoom: zoomlevel});
				}
				if (centeronlocation && navigator.geolocation) {
					navigator.geolocation.getCurrentPosition(function(position) {
						if(projection) {
							var p = new Point(position.coords.longitude, position.coords.latitude, new esri.SpatialReference({ wkid: wkid }));
							proj4(proj4('EPSG:4326'),projection,p);
							map.centerAt(p);
						} else {
							map.centerAt(new Point(position.coords.longitude, position.coords.latitude, new esri.SpatialReference({ wkid: wkid })));
						}
					});
				}
			}
			map.addLayer(baseMapLayer);
			map.addLayer(markerLayer);
			map.addLayer(positionLayer);

			map.on("click", function(evt) {
				if (evt.graphic && !evt.graphic.infoTemplate) {
					map.infoWindow.setTitle(evt.graphic.attributes.title);
					map.infoWindow.setContent(evt.graphic.attributes.description);
					map.infoWindow.show(evt.screenPoint,map.getInfoWindowAnchor(evt.screenPoint));
				} else {
					if (!kdf.form.readonly) {
						map.graphics.clear();
						map.infoWindow.hide();
						var point = new Point(evt.mapPoint.x,evt.mapPoint.y, new esri.SpatialReference({ wkid: wkid }));
						marker = new Graphic(point, markerSymbol);
						positionLayer.clear();
						positionLayer.add(marker);
						$('#'+id+'_lon').val(point.x);
						$('#'+id+'_lat').val(point.y);

						$('#dform_'+kdf.name).trigger('_KDF_mapClicked', [ kdf, 'arcgis', name, map, positionLayer, markerLayer, marker, point.getLongitude(), point.getLatitude(), null, null ] );
						$(mapHolder).removeClass('dform_maperror');
						$(mapHolder).siblings('.dform_validationMessage').hide();
						if (reversegeocode) {
							reverseGeocode(id,reversegeocodeaction,reversegeocodesetid,reversegeocodeobjecttype,reversegeocodeloaddata,reversegeocodeloadpage);
						}
					}
				}
			});

			if (search) {
				var searchwidget;
				if (geocodeonline) {
					searchwidget = new Search({
						map: map,
						enableSuggestions: enablesuggestions,
						showInfoWindowOnSelect: false
					}, id+'_arcgis_search');
					searchwidget.startup();
				} else {
					searchwidget = new Search({
						map: map,
						enableSuggestions: enablesuggestions,
						showInfoWindowOnSelect: false,
						sources: [{locator: new Locator(locatorurl), singleLineFieldName: singlelinefieldname, outFields: [outfields], placeholder: kdf.messages.gisquery}]
					}, id+'_arcgis_search');
				}
				
				if (searchextent) {
					//Create extent to limit search - needs added to UI for configuration
					var geoExtent = new Extent({
						"spatialReference": {
							"wkid": wkid
						},
						"xmin": minx,
						"xmax": maxx,
						"ymin": miny,
						"ymax": maxy
					});
	    			searchwidget.sources[0].searchExtent = geoExtent;
				}
					
      			searchwidget.startup();
				kdf.arcgissearchwidgets.push(searchwidget);
				$('#dform_widget_'+name+'_arcgis_search_input').parent().append('<input type="submit" style="display: none;" value="'+kdf.messages.gisquery+'"/>');
			}
			if (customaction) {
				initialiseGISCaseLayer(map,customaction,id,projection,'arcgis',markerLayer,name,wkid);
			}
			$('#dform_'+kdf.name).trigger('_KDF_mapReady', [ kdf, 'arcgis', name, map, positionLayer, markerLayer, marker, null ] );
			return map;
        });
	}

	function initialiseGISCaseLayer(map,action,id,projection,maptype,markerLayer,name,wkid) {

		var infowindow;
		if (maptype != 'argis') {
			infowindow = new google.maps.InfoWindow();
		}

		var data = $.extend({}, kdf.params);
		$.extend(data, $('#dform_'+kdf.name).find('input, select, textarea').serializeJSON({useAlias: true, useIntKeysAsArrayIndex: true}))

		var giscustomrequest={
			"name": kdf.form.name,
			"data": data,
			"email": kdf.form.email,
			"caseid": kdf.form.caseid,
			"xref": kdf.form.xref,
			"xref1": kdf.form.xref1,
			"xref2": kdf.form.xref2
		}

		$.ajax({
			url: kdf.rest.custom+'?action='+action+'&actionedby='+id+'&loadform=true&access='+kdf.access+'&locale='+kdf.locale,
			data: JSON.stringify(giscustomrequest),
			type: 'POST', dataType: 'json', contentType: 'application/json', mimeType: 'application/json',
			beforeSend: ajaxSend
		}).done(function(response, status, xhr) {
			kdf.auth=xhr.getResponseHeader('Authorization');
			if (response.data) {
				if (maptype != 'arcgis') {
					loadGoogleMarkers(response.data,projection,map,infowindow);
				} else {
					loadArcGISMarkers(response.data,markerLayer,wkid);
				}
			}
		}).fail(ajaxError);
	}

	function loadGoogleMarkers(data,projection,map,infowindow) {
		$.each(data, function() {
			var markerinfo = this;
			if (projection) {
				var latLng = proj4(projection,proj4('EPSG:4326'),[markerinfo.latitude,markerinfo.longitude]);
				markerinfo.latitude = latLng[1];
				markerinfo.longitude = latLng[0];
			}
			var marker = new google.maps.Marker({position: new google.maps.LatLng(markerinfo.latitude,markerinfo.longitude), map: map, icon: markerinfo.icon, title: markerinfo.title});
			marker.setZIndex(1);
			google.maps.event.addListener(marker, 'click', function() {
				infowindow.close();
				infowindow.setContent(markerinfo.description);
				infowindow.open(map, this);
			});
		});
	}

	function loadArcGISMarkers(data,caseLayer,wkid) {
		require(["esri/map", "esri/geometry/Point", "esri/symbols/SimpleMarkerSymbol", "esri/symbols/PictureMarkerSymbol", "esri/graphic",  "esri/layers/GraphicsLayer", "dojo/domReady!" ],
		function(Map, Point, SimpleMarkerSymbol, PictureMarkerSymbol, Graphic, GraphicsLayer) {
			$.each(data, function() {
				var markerinfo = this;
				var point = new Point(Number(markerinfo.longitude),Number(markerinfo.latitude), new esri.SpatialReference({ wkid: wkid }));
				var markerSymbol = new PictureMarkerSymbol(markerinfo.icon, 32, 32);
				markerSymbol.setOffset(0, 16);
				var marker = new Graphic(point,markerSymbol);
				marker.setAttributes({"title":markerinfo.title,"description":markerinfo.description});
				caseLayer.add(marker);
			});
		});
	}

	function displayReverseGeocode(id) {
		if ($('#'+id+'_rgeo_desc').val() != '') {
			$('#'+id+'_reversegeo').html('<img src="/dformresources/content/rgeo.png" alt="pin" title="['+$('#'+id+'_lon').val()+','+$('#'+id+'_lat').val()+']"/> '+$('#'+id+'_rgeo_desc').val());
		}
	}

	function reverseGeocode(id,reversegeocodeaction,reversegeocodesetid,reversegeocodeobjecttype,reversegeocodeloaddata,reversegeocodeloadpage) {
		if ($('#'+id+'_lon').val() != '' && $('#'+id+'_lat').val() != '') {
			var giscustomrequest={
				"name": kdf.form.name,
				"data": {"longitude":$('#'+id+'_lon').val(),"latitude":$('#'+id+'_lat').val()},
				"email": kdf.form.email,
				"caseid": kdf.form.caseid,
				"xref": kdf.form.xref,
				"xref1": kdf.form.xref1,
				"xref2": kdf.form.xref2
			}
			lock();
			$.ajax({
				url: kdf.rest.custom+'?action='+reversegeocodeaction+'&actionedby='+id+'&loadform=true&access='+kdf.access+'&locale='+kdf.locale,
				data: JSON.stringify(giscustomrequest),
				type: 'POST', dataType: 'json', contentType: 'application/json', mimeType: 'application/json',
				beforeSend: ajaxSend
			}).done(function(response, status, xhr) {
				kdf.auth=xhr.getResponseHeader('Authorization');
				if (response.data) {
					$('#'+id+'_rgeo_id').val(response.data.id);
					$('#'+id+'_rgeo_desc').val(response.data.description);
					$('#'+id+'_rgeo_dist').val(response.data.distance);
					$('#'+id+'_reversegeo').html('<img src="/dformresources/content/rgeo.png" alt="pin" title="['+$('#'+id+'_lon').val()+','+$('#'+id+'_lat').val()+']"/> '+$('#'+id+'_rgeo_desc').val());
					if (reversegeocodesetid) {
						setObjectID(reversegeocodeobjecttype,response.data.id,reversegeocodeloaddata,reversegeocodeloadpage);
					} else if (reversegeocodeloaddata) {
						getObjectData(reversegeocodeobjecttype,response.data.id,reversegeocodeloadpage);
					}
				}
				unlock();
			}).fail(ajaxError);
		}
	}

	function checkGIS(mapHolder,custom) {
		var errorClass = 'dform_maperror';
		if (custom)
			errorClass = 'dform_maperrorCustom';

		$(mapHolder).removeClass('dform_maperror');
		$(mapHolder).removeClass('dform_maperrorCustom');
		$(mapHolder).siblings('.dform_validationMessage').hide();

		if ($(mapHolder).parent().hasClass('dform_hidden'))
			return true;

		var id = $(mapHolder).attr('id');
		var lat = Number($('#'+id+'_lat').val());
		var lon = Number($('#'+id+'_lon').val());
		var required = $(mapHolder).attr('data-required');
		var message = $(mapHolder).attr('title');

		if (isNaN(lat)) {lat = 0;}
		if (isNaN(lon)) {lon = 0;}

		if ((required == 'true' || custom) && (lat == 0 || lon == 0)) {
			$(mapHolder).addClass(errorClass);
			$(mapHolder).siblings('.dform_validationMessage').show();
			return false;
		}
		return true;
	}

	function initialiseFunnelback(fnlbHolder) {
		if (!$(fnlbHolder).is(':visible') || $(fnlbHolder).attr('data-searchinit'))
			return;
		$(fnlbHolder).attr('data-searchinit',true);

	    var auto = Boolean($(fnlbHolder).attr('data-auto') == 'true');
	    var popup = Boolean($(fnlbHolder).attr('data-popup') == 'true');

	    $(fnlbHolder).attr('data-search',$(fnlbHolder).find('.fnlb_search').val());
	    if (auto) {
	        $(fnlbHolder).find('.fnlb_search_results').html('<img src="/dformresources/content/ajax-loader.gif"/>');
		    searchFunnelback(fnlbHolder);
	    }

	    $(fnlbHolder).on('click', 'span.fnlb_paging_active', function() {
	        $(fnlbHolder).attr('data-startrank',$(this).data('startrank'));
	        searchFunnelback(fnlbHolder);
	        $(fnlbHolder).find('.fnlb_search').focus();
	    });

	    $(fnlbHolder).on('click', '.fnlb_search_but', function() {
	        searchFunnelback(fnlbHolder);
	    });

	    $(fnlbHolder).on('keyup', '.fnlb_search', function(event) {
	        if (event.which == 13) {
	            searchFunnelback(fnlbHolder);
	        }
	    });

	    if (popup) {
		    $(fnlbHolder).on('click', '.fnlb_title', function(event) {
				if (kdf.history != undefined) {
					kdf.history.pushState({page: -1, rand: Math.random()}, '', '');
				}
		        event.preventDefault();
		        window.scrollTo(0,0);
		        $('#dform_lock').show();
		        var popheight = $(window).height()-40;
		        var iframeheight = $(window).height()-100;
		        var html = '';
		        html += '<div class="fnlb_close right">:</div>';
		        html += '<iframe width="100%" height="'+iframeheight+'" src="'+$(this).attr('href')+'"></iframe>';
		        $(fnlbHolder).find('.fnlb_popup').html(html).width($(window).width()-30).height(popheight).show('clip');
		        $(fnlbHolder).find('.fnlb_close').click(function() {
		            $(fnlbHolder).find('.fnlb_popup').html('').hide();
		            $('#dform_lock').hide();
		        });
		    });
	    } else {

	    }

	    $(fnlbHolder).on('input, keyup', '.fnlb_search', function() {
            suggestFunnelback(fnlbHolder);
	    });
	}

	function searchFunnelback(fnlbHolder) {

	    var url = $(fnlbHolder).attr('data-url');
	    var collection = $(fnlbHolder).attr('data-collection');
	    var startrank = Number($(fnlbHolder).attr('data-startrank'));
	    var paged = Boolean($(fnlbHolder).attr('data-paged') == 'true');

		$(fnlbHolder).find('.fnlb_suggestions').hide().empty();
	    $(fnlbHolder).addClass("fnbl_locked");
	    $(fnlbHolder).find('.fnlb_search_icon').html('<img height="15" width="15" src="/dformresources/content/fnlb-loader.gif"/>');

		return $.ajax({
			url: url+'/s/search.json?start_rank='+startrank+'&collection='+collection+'&query='+$(fnlbHolder).find('.fnlb_search').val(),
			type: 'GET', dataType: 'jsonp', contentType: 'application/json', mimeType: 'application/json'
		}).done(function(fb, status, xhr) {
			$(fnlbHolder).find('.fnlb_suggestions').hide().empty();
		    if (fb.response.resultPacket && fb.response.resultPacket.resultsSummary && fb.response.resultPacket.resultsSummary.totalMatching !== 0) {
	    	    var resultsSummary = fb.response.resultPacket.resultsSummary;
	    	    var html = '';

	    	    $.each(fb.response.resultPacket.results, function() {
	    			var result = this;
	    			html += '<div class="fnlb_result">';
	    			html += '<a class="fnlb_title" href="'+result.liveUrl+'">'+result.title+'</a>';
	    			html += '<a class="fnlb_newwindow" target="_blank" href="'+result.liveUrl+'">c</a>';
	    			html += '<div class="fnlb_link">'+result.displayUrl+'</div>';
	    			html += '<div class="fnlb_summary">'+result.summary+'</div>';
	    			html += '</div>';
	    	    });

	    	    if (paged) {
	        	    html+='<div class="fnlb_paging">';
	                if (resultsSummary.prevStart) {
	                    html += '<span class="fnlb_paging_active" data-startrank="'+resultsSummary.prevStart+'">previous</span>';
	                }
	                var pages = Math.floor(resultsSummary.totalMatching/resultsSummary.numRanks);
	        	    for (i = 0; i < pages; i++) {
	        	        var start = ((resultsSummary.numRanks*i)+1);
	        	        if (resultsSummary.currStart == start) {
	        	            html += '<span class="fnlb_paging_disabled">'+(i+1)+'</span>';
	        	        } else {
	        	            html += '<span class="fnlb_paging_active" data-startrank="'+start+'">'+(i+1)+'</span>';
	        	        }
	                }
	                if (resultsSummary.nextStart) {
	                    html += '<span class="fnlb_paging_active" data-startrank="'+resultsSummary.nextStart+'">next</span>';
	                }
	        	    html+='</div>';
	    	    }

	    	    $(fnlbHolder).find('.fnlb_search_results').html(html);
	    	    $(fnlbHolder).removeClass("fnbl_locked");
	    	    $(fnlbHolder).find('.fnlb_search_icon').html('@');
		    } else {
		        $(fnlbHolder).find('.fnlb_search_results').html('');
		        $(fnlbHolder).removeClass("fnbl_locked");
		        $(fnlbHolder).find('.fnlb_search_icon').html('@');
		    }
		}).fail(function() {
		    KDF.showError('Oops');
		    $(fnlbHolder).removeClass("fnbl_locked");
	    });
	}

	function suggestFunnelback(fnlbHolder) {
	    var url = $(fnlbHolder).attr('data-url');
	    var collection = $(fnlbHolder).attr('data-collection');
		return $.ajax({
		    url: url+'/s/suggest.json?collection='+collection+'&show=10&partial_query='+$(fnlbHolder).find('.fnlb_search').val(),
			type: 'GET', dataType: 'jsonp', contentType: 'application/json', mimeType: 'application/json'
		}).done(function(fb, status, xhr) {
		    $(fnlbHolder).find('.fnlb_suggestions').hide().empty();
		    var foundresult=false;
		    $.each(fb, function( index, value ) {
		        $(fnlbHolder).find('.fnlb_suggestions').append('<span>'+value+'</span>');
		        foundresult=true;
		    });
		    if (foundresult) {
			    $(fnlbHolder).find('.fnlb_suggestions').show();
			    $(fnlbHolder).find('.fnlb_suggestions span').click(function() {
			     	$(fnlbHolder).find('.fnlb_search').val($(this).html());
			     	$(fnlbHolder).find('.fnlb_suggestions').hide().empty();
			     	searchFunnelback(fnlbHolder);
			    });
			}
		}).fail(function() {
		    KDF.showError('Oops');
		});
	}


	// Initialisation & control

	function ready() {
		initControls();
		$('#dform_home').hide();
		$('#dform_controls').show();
		$('#dform_holder').show();
		kdf.pages=$('div[data-type="page"]').length;
		initButtonLogic('#dform_'+kdf.name);
		initNavigation();
		initLogic('#dform_'+kdf.name);
		initRealtimeValidation('#dform_'+kdf.name);
		initOnetomany('#dform_'+kdf.name);
		initFileUpload('#dform_'+kdf.name);
		initHistoryTracking();
		modernize('#dform_'+kdf.name);
		unlock();
		$( '#dform_'+kdf.name ).find('option.dform_hidden').wrap('<span class="dform_hidden"/>');

		if ($('#dform_navigation li[data-pos="'+kdf.form.currentpage+'"]').is(':visible')) {
			gotoPage(kdf.form.currentpage,false,false,true);
		} else {
			kdf.form.currentpage = '1';
			gotoPage(kdf.form.currentpage,false,false,true);
		}

		if (kdf.recaptcha) {
			enableRecaptcha();
		}
		
		//OFORMS-85: wait for the form to have fully loaded and then set any params as required
		//OFORMS-105: moved prior to the _KDF_previewReady and _KDF_ready events
		loadForm(kdf.params);
		//OFORMS-113: move the loading of files to after onetomany widgets have been initialised
		if (kdf.form.files && kdf.form.files.length > 0) {
			$(kdf.form.files).each(function() {
				var fileitem = $('<span>');
				fileitem.attr('data-filename', this.filename);
				fileitem.attr('data-token', this.token);
				fileitem.attr('data-ref', kdf.form.ref);
				fileitem.append(escapeHtml(this.filename) + '<span class="file_delete">4</span>');
				fileitem.appendTo('#' + this.field + '_files');
				
				var link = '<a target="_blank" href="'+kdf.restapi+'getfile?ref='+kdf.form.ref+'&filename='+encodeURIComponent(this.filename)+'">'+escapeHtml(this.filename)+'</a>';
				//TODO: this.links[0].href should be used but Spring Hateous double encoding
				$('#dform_files').append(link);
			});

		}
		
		$( '#dform_'+kdf.name ).trigger('_KDF_previewReady', [ kdf ] );
		$( '#dform_'+kdf.name ).trigger('_KDF_ready', [ kdf ] );
		if (kdf.form.readonly) {
			if (kdf.viewmode != 'U') {
				makeReadonly();
				showWarning(kdf.messages.formReadonlyMsg);
			} else {
				kdf.form.readonly = false;
				saveOnNavToLastPage();
			}
		}


		if($('#dform_'+kdf.name).attr('data-startaction')) {
			custom($('#dform_'+kdf.name).attr('data-startaction'), 'start_action', '#dform_'+kdf.name, '', false, true, true);
		}
	}

	function enableRecaptcha() {
		var lastnavpageid=kdf.pages-1;
		var recaptchapage = kdf.pages-1;
		
		while (true && lastnavpageid > 0) {
			if ($('.dform_page[data-pos="'+lastnavpageid+'"]').attr('data-active') == 'true') {
				recaptchapage = lastnavpageid;
				break;
			} else {
				//do initNavigation to reset button navigation should the active pages have changed
				initNavigation();
			}
			lastnavpageid--;
		}
		
		$('.dform_page[data-pos="'+recaptchapage+'"]').find('button[data-type="next"]').unbind('click').click(function() {
			openRecaptcha('next');
		});
		
		$('button[data-type="move"]').each(function () {
			var gotoid = Number($('#dform_page_'+$(this).attr('data-moveto')).attr('data-pos'));
			if (gotoid >= kdf.pages) {
				$(this).unbind('click').click(function() {
					openRecaptcha('move');
				});
			}
		});
	}

	function openRecaptcha(buttontype) {
		var lastnavpageid=kdf.pages-1;
		while (true && lastnavpageid > 0) {
			if ($('.dform_page[data-pos="'+lastnavpageid+'"]').attr('data-active') == 'true') {
				break;
			}
			lastnavpageid--;
		}
		
		//Ensure that if a 'next' button has been clicked that it is the last page in the navigation tree
		//If a 'move' button has been clicked then we proceed to recaptcha
		if(lastnavpageid == kdf.form.currentpage || buttontype=='move') {
			if (check('.dform_page[data-pos="'+kdf.form.currentpage+'"]') != 0) {
				$('#dform_navigation li[data-pos="'+kdf.form.currentpage+'"]').removeClass('dform_pageValid dform_pageInvalidCustom').addClass('dform_pageInvalid');
				return;
			} else {
				$('#dform_navigation li[data-pos="'+kdf.form.currentpage+'"]').removeClass('dform_pageInvalid dform_pageInvalidCustom').addClass('dform_pageValid');
				if (checkProgress() != 0) {
					showError(kdf.messages.checkFormMsg);				
					showNav();
					return;
				}
			}

			$.fn.center = function () {
				this.css("position","fixed");
				this.css("top", Math.max(0, ($(window).height() - $(this).outerHeight()) / 2) + "px");
				this.css("left", Math.max(0, ($(window).width() - $(this).outerWidth()) / 2) + "px");
				return this;
			};

			$('#dform_lock').show();
			$('#dform_recaptcha_render').remove();
			$('#dform_recaptcha').append('<div id="dform_recaptcha_render"></div>');
			kdf.captchaWidgetId = grecaptcha.render( 'dform_recaptcha_render', {'sitekey' : kdf.recaptchakey, 'callback' : function() {
				gotoPage(kdf.pages,false,true,true);
				$('#dform_lock, #dform_recaptcha').hide();
			}});

			$('#dform_recaptcha').center().show();
			$('.recaptcha_close').unbind('click').click(function() {
				$('#dform_lock, #dform_recaptcha').hide();
			});
		} else {
			//'next' button clicked that is no longer the last button in the navigation tree, therefore
			//reset enableRecaptcha and browse to the next page in the tree
			enableRecaptcha();
			gotoNextPage();
		}
	}

	function home() {
		$('#dform_home').show();
		initRealtimeValidation('#dform_home')
		$('#dform_holder').empty().hide();
		$('#dform_controls').hide();
		$('input[type=password]').val('');
		kdf.sessioncomplete=false;
		unlock();
	}

	function initLaunchControls() {
		$('#dform_start').unbind('click').click(function() {
			hideMessages();
			$('#dform_ref_display span').html('');
			$('#dform_ref_display').hide();
			if (!kdf.authenticated) {
				kdf.requestpassword=true;
			}
			if (kdf.action) {
				content().then(fill).then(initial);
			} else {
				content().then(fill);
			}
		});
		$('#dform_resume').unbind('submit').submit(function(event) {
			hideMessages();
			event.preventDefault();
			if (check('#dform_resume') != 0)
				return;
			getpost().then(content).then(fill);
		});
	}

	function initControls() {
		$('#dform_save').unbind('click').click(function() {
			checkSave();
		});
		$('#dform_close').unbind('click').click(function() {
			lock();
			$('#dform_holder').empty();
			var count = kdf.arcgissearchwidgets.length;
			for (var i = 0; i < count; i++) {
				kdf.arcgissearchwidgets[i].destroy();
			}
			kdf.arcgissearchwidgets = [];
			delete kdf.captchaWidgetId;
			form().then(home);
		});
		$('#dform_check').unbind('click').click(function() {
			checkProgress();
		});
		$('#dform_makewritable').unbind('click').click(function() {
			makeWritable();
		});
		$('#dform_password_entry_form').unbind('submit').submit(function(event) {
			event.preventDefault();
			if (check('#dform_password_entry_form') != 0)
				return;
			kdf.form.password=$('#dform_password_save').val();
			save();
			$('#dform_password_entry').hide();
		});
		$('#dform_cancel_save').unbind('click').click(function() {
			$('#dform_password_entry').hide();
		});
		$('#dform_print').unbind('click').click(function() {
			window.print();
		});
		$('#dform_download').unbind('click').click(function() {
			download();
		});
	}

	function listForms() {
		$('#dform_view_list, #dform_resume_list').html('');
		if (kdf.userforms) {
			$.each(kdf.userforms, function() {
				var get;
				$.each(this.links, function() {
					if (this.rel == 'get') {
						var href;
						this.href.indexOf('?') > 0 ? href = this.href.substr(0, this.href.indexOf('?')) : href = this.href;
						get=this.href;
					}
				});
				var viewed;
				if (this.modified && this.modified != 'null') {
					viewed=Date.parse(this.modified.substr(0,16)).toString();
				} else {
					viewed=Date.parse(this.created.substr(0,16)).toString();
				}
				var displayRef = this.ref;
				if (this.caseid) {
					displayRef +='-'+this.caseid;
				}				
				var link='<a href="javascript:void(0);" data-ref="'+this.ref+'" data-resume="'+get+'">'+displayRef+'</a>&nbsp;'+viewed.substr(0,21)+'<br/>';
				if (this.complete == 'Y') {
					$('#dform_view_list').append(link);
				} else {
					$('#dform_resume_list').append(link);
				}
			});
		}
		$('#dform_view_list a, #dform_resume_list a').unbind('click').click(function() {
			kdf.rest.get=$(this).data('resume');
			get().then(content).then(fill);
		});
	}

	function processLinks(links) {
		$.each(links, function() {
			var basehref = this.href;
			basehref.indexOf('?') > 0 ? basehref = basehref.substr(0, basehref.indexOf('?')) : basehref = this.href;
			// Hack to fix rest api calls using http not https
			basehref = basehref.replace(/^http:\/\//i, 'https://');
			
			if (this.rel == 'save') {
				kdf.rest.save=this.href.replace(/^http:\/\//i, 'https://');;
			}
			if (this.rel == 'setinteractionid') {
				kdf.rest.setinteractionid=basehref;
			}
			if (this.rel == 'setobjectid') {
				kdf.rest.setobjectid=basehref;
			}
			if (this.rel == 'getobjectdata') {
				kdf.rest.getobjectdata=basehref;
			}
			if (this.rel == 'getpost') {
				kdf.rest.getpost=basehref;
			}
			if (this.rel == 'custom') {
				kdf.rest.custom=basehref;
			}
			if (this.rel == 'widget') {
				kdf.rest.widget=basehref;
			}
			if (this.rel == 'attachFiles') {
				kdf.rest.attachFiles=basehref;
			}
			if (this.rel == 'deleteFile') {
				kdf.rest.deleteFile=basehref;
			}
			if (this.rel == 'content') {
				kdf.rest.content=this.href.replace(/^http:\/\//i, 'https://');;
			}
			if (this.rel == 'download') {
				kdf.rest.download=this.href.replace(/^http:\/\//i, 'https://');;
			}
		});
	}

	function resetControls() {
		$('#dform_progressbar, #dform_save, #dform_check, #dform_print').show();
	}

	function makeReadonly() {
		$('#dform_makewritable').show();
		$('#dform_progressbar, #dform_save, #dform_check, #dform_togglenav').hide();
		$('#dform_'+kdf.name).find('input, select, textarea').prop('readonly',true);
		$('#dform_'+kdf.name).find('select option:not(:selected)').attr('disabled',true);
		$('#dform_'+kdf.name).find(':radio:not(:checked)').attr('disabled',true);
		$('#dform_'+kdf.name).find('input[type=file]').attr('disabled', true);
		$('#dform_'+kdf.name).find(':checkbox').click(function(event) {
			event.preventDefault();
		});
		$('#dform_'+kdf.name).find('button').prop('disabled',true);
		$('#dform_'+kdf.name).find('button[data-type="next"],button[data-type="prev"]').prop('disabled',false);
		$('#dform_'+kdf.name).find('.searchwidget, .otom_delete').hide();
		disableNavToLastPage();
		disableLogic('#dform_'+kdf.name);
		kdf.form.readonly=true;
	}

	function makeWritable() {
		$('#dform_makewritable').hide();
		$('#dform_progressbar, #dform_save, #dform_check').show();
		$('#dform_'+kdf.name).find('input, select, textarea').prop('readonly',false);
		$('#dform_'+kdf.name).find('select option:not(:selected)').attr('disabled',false);
		$('#dform_'+kdf.name).find(':radio:not(:checked)').attr('disabled',false);
		$('#dform_'+kdf.name).find('input[type=file]').attr('disabled', false);
		$('#dform_'+kdf.name).find(':checkbox').unbind('click');
		$('#dform_'+kdf.name).find('button').prop('disabled',false);
		$('#dform_'+kdf.name).find('.searchwidget, .otom_delete').show();
		if (kdf.form.currentpage == kdf.pages) {
			gotoPage(1,true,true,true);
		}		
		showNav();
		initButtonLogic('#dform_'+kdf.name);
		initNavigation();
		initLogic('#dform_'+kdf.name);
		resetControls();
		hideMessages();
		saveOnNavToLastPage();
		kdf.form.readonly=false;
	}

	function markComplete() {
		makeReadonly();
		hideNav();
	}

	function disableNavToLastPage() {
		var lastnavpageid=kdf.pages-1;
		while (true && lastnavpageid > 0) {
			if ($('.dform_page[data-pos="'+lastnavpageid+'"]').attr('data-active') == 'true') {
				break;
			}
			lastnavpageid--;
		}
		$('.dform_page[data-pos="'+lastnavpageid+'"]').find('button[data-type="next"]').unbind('click').click(function() {
			showWarning(kdf.messages.formCompleteMsg);
		});
		$('button[data-type="move"]').each(function () {
			var gotoid = Number($('#dform_page_'+$(this).attr('data-moveto')).attr('data-pos'));
			if (gotoid >= kdf.pages) {
				$(this).unbind('click').click(function() {
					showWarning(kdf.messages.formCompleteMsg);
				});
			}
		});
	}

	function saveOnNavToLastPage() {
		var lastnavpageid=kdf.pages-1;
		while (true && lastnavpageid > 0) {
			if ($('.dform_page[data-pos="'+lastnavpageid+'"]').attr('data-active') == 'true') {
				break;
			}
			lastnavpageid--;
		}
		$('.dform_page[data-pos="'+lastnavpageid+'"]').find('button[data-type="next"]').unbind('click').click(function() {
			save();
		});
		$('button[data-type="move"]').each(function () {
			var gotoid = Number($('#dform_page_'+$(this).attr('data-moveto')).attr('data-pos'));
			if (gotoid >= kdf.pages) {
				$(this).unbind('click').click(function() {
					save();
				});
			}
		});
	}



	// Modernize

	function modernize(selector) {
		$(selector).find('input[type="date"]').each(function(){
			if (!Modernizr.inputtypes.date) {
				// If no native date function create a new field of type text and add juery datepicker
				var newDateField = $(this).clone(true);
				$(newDateField).attr('id', '_JQDP_'+$(this).attr('id'));
				$(newDateField).attr('name', '_JQDP_'+$(this).attr('name'));				
				$(newDateField).val(convertDate($(this).val(),kdf.dateformat));
				$(newDateField).addClass('dform_nopersist');
				$(newDateField).attr('placeholder', kdf.dateformat);
				$(newDateField).datepicker({
					dateFormat: kdf.jq_dateformat,
					changeMonth: true,
					changeYear: true,
					yearRange:'-120:+120',
					altFormat: 'yy-mm-dd',
					altField: $(this),
					minDate: processJQDate(newDateField.data('mindate')),
					maxDate: processJQDate(newDateField.data('maxdate')),
					beforeShow: function() {
						if ($(this).prop('readonly')) {
							return false;
						}
						kdf.realtimeValidationOn=false;
					},
					onClose: function() {
						clearFieldError(this, false);
						kdf.realtimeValidationOn=true;
						validateInput('#' + $(this).attr('id'));
					},
					onSelect: function() {
						kdf.realtimeValidationOn=true;
						clearFieldError(this, false);
						clearFieldError(this, true);
						triggerFieldSet(this);
					}
				});
				$(newDateField).appendTo($(this).parent());
				// Set HTML5 min & max from mindate/maxdate
				$(newDateField).attr('min', processDate($(this).data('mindate')));
				$(newDateField).attr('max', processDate($(this).data('maxdate')))
				$(this).hide();
			}
			// Set HTML5 min & max from mindate/maxdate
			$(this).attr('min', processDate($(this).data('mindate')));
			$(this).attr('max', processDate($(this).data('maxdate')))
		});
	}

	function processJQDate(date) {
		if(date != null) {
			if(isNaN(parseInt(date.slice(-1)))) {
				return date;
			}
			else {
				return Date.parse(date);
			}
		}
	}

	function processDate(modifyby) {
		if (!modifyby) {
			return;
		}
		if(isNaN(parseInt(modifyby.slice(-1)))) {
			var date = Date.today();
			var dateArr = modifyby.split(' ');
			for (i=0; i<dateArr.length; i++) {
				var period = dateArr[i].charAt(dateArr[i].length -1);
				var len = parseInt(dateArr[i].substring(0,dateArr[i].length -1));
				if (period == 'Y') {
					date.add(len).years();
				} else if (period == 'M') {
					date.add(len).months();
				} else if (period == 'D') {
					date.add(len).days();
				}
			}
			return date.toString('yyyy-MM-dd');
		}
		else {
			return Date.parse(modifyby).toString('yyyy-MM-dd');
		}
	}

	function convertDate(txtDate,format){
		if (!txtDate)
			return;
		return Date.parse(txtDate).toString(format);
	}

	function isDate(txtDate) {
		if (Date.parse(txtDate)) {
			return true;
		} else {
			return false;
		}
	}

	function setDefaultDates() {
		$('input[data-setdate]').each(function(){
			if($(this).val() == '') {
				$(this).val(processDate($(this).data('setdate')));
			}
		});
	}

	// Populate form
	function fill() {
		var info = {};
		info['access']=kdf.access;
		info['authenticated']=kdf.authenticated.toString();
		info['auto']=kdf.auto.toString();
		info['resumed']=kdf.resumed.toString();
		info['requestpassword']=kdf.requestpassword.toString();
		info['launchpage']=kdf.form.currentpage;
		info['customerset']=kdf.customerset;
		loadForm(info);
		loadForm(kdf.profileData);
		//loadForm(kdf.params); //OFORMS-85: wait for the form to have fully loaded and then set any params as required
		loadForm(kdf.form.data);
		//OFORMS-113 - moved loading of files from here to the ready() method
		KDF.setDefaultDates();
		ready();
	}

	function loadForm(data,preappend,append,holder,selector) {

		if (!preappend) {preappend='';}
		if (!append) {append='';}
		if (!holder) {holder='';}
		if (!selector) {selector=''};

		if (data) {
			$.each(data, function(key,value) {
				if (value instanceof Object) {
					loadWidget(key,value,preappend,append,holder,selector);
				} else {
					loadField(key,value,preappend,append,holder,selector);
				}
			});
		}
	}

	function loadWidget(key,value,preappend,append,holder,selector) {

		if (!selector) {selector=''};

		if (isNaN(key)) {
			var containers=$('#dform_'+kdf.name+' '+selector+' .dform_widget_'+key+', #dform_childpages .dform_widget_'+key);
			if (containers.length) {
				$.each(containers, function() {
					var container = this;
					switch ($(container).attr('data-type')) {
						case 'onetomany':
							$('#'+holder+'dform_childpage_holder_'+key).empty();
							$.each(value, function(pos) {
								clone($('#'+holder+'dform_childpage_holder_'+key),false);
							});
							loadForm(value,preappend+''+key+'',']',holder+key);
							break;
						case 'table':
							if (value instanceof Array) {
								loadTable(key, value, $(container).find('.dform_table'));
							}
							break;
						case 'radio':
							if (value instanceof Array) {
								loadRadio(key, value, container);
							}
							break;
						case 'select':
							if (value instanceof Array) {
								loadSelect(key, value, container);
							}
							break;
						case 'multicheckbox':
							loadField(key,value,preappend,append,holder);
							break;
						case 'html':
							$(container).html(value);
							break;
						case 'header':
							$(container).html(value);
							break;
					}
				});
			}
		} else {
			if (preappend.indexOf('[') == -1) {
				loadForm(value,preappend+'['+key+'][',']',holder+key,selector);
			} else {
				loadForm(value,preappend+'['+key+']][',']',holder+key,selector);
			}
		}
	}

	function loadField(key,value,preappend,append,holder,selector) {

		if (value instanceof Array) {key=key+'[]'};
		if (preappend) {key=preappend+key;}
		if (append) {key=key+append;}
		if (!selector) {selector = ''};

		var elements=$('#dform_'+kdf.name+' '+selector+' [name="'+key+'"], #dform_'+kdf.name+' '+selector+' [data-mapfrom="'+key+'"], #dform_childpages '+selector+' [name="'+key+'"], #dform_childpages '+selector+' [data-mapfrom="'+key+'"]');
		if (elements.length) {
			$.each(elements, function() {
				var element = this;
				$(element).closest('.dform_widget_field').attr('data-value',value);
				if ($(element).prop('tagName')) {
					var type=$(element).prop('tagName').toLowerCase();
					if (type == 'input')
						type=$(element).attr('type');

					switch (type) {
						case 'radio':
							if ($(element).prop('value') == value) {
								$(this).prop('checked', 'checked');
								processLogicRadio(this);
								triggerFieldSet(this);
							}
							break;
						case 'checkbox':
							if (value instanceof Array) {
								if ($.inArray(this.value, value) >= 0) {
									if ($(element).prop('value') == this.value) {
										$(this).prop('checked', 'checked');
									}
									triggerFieldSet(element);
								}
							} else {
								if ($(element).prop('value') == value) {
									$(this).prop('checked', 'checked');
								}
								processLogicCheckbox(element);
								triggerFieldSet(element);
							}
							break;
						case 'select':
							$(element).val(value);
							processLogicSelect(element);
							triggerFieldSet(element);
							break;
						case 'span':
							$(element).html(value);
							break;
						default:
							$(element).val(value);
							triggerFieldSet(element);
							break;
					}
				}
			});
		} else {
			loadWidget(key,value,preappend,append,holder);
		}
	}

	function loadRadio(fieldid, data, container) {
		fieldid = $(container).data('name');
		var group = $(container).find('.radiogroup');
		var value = $(container).attr('data-value');

		var groupcopy = $('#dform_radiodefault_'+fieldid).clone();
		var radiocopy = groupcopy.find('span').clone();
		groupcopy.find('span').remove();
		$(group).empty();
		$(group).html(groupcopy.html());
		$(group).find('.dform_validationMessage').hide();
		var found = false;
		$.each(data, function(pos) {
			var radiocopy = $('#dform_radiodefault_'+fieldid).find('span').clone();
			radiocopy.find('input').attr('id','dform_widget_'+fieldid+pos);
			radiocopy.find('input').attr('class','radiooption');
			radiocopy.find('input').attr('value',this.value);
			if (this.selected || value == this.value) {
				radiocopy.find('input').attr('checked','checked');
			}
			radiocopy.find('label').html(this.label);
			radiocopy.find('label').attr('for','dform_widget_'+fieldid+pos);
			$(group).append('<span class="radiooption">'+radiocopy.html()+'</span>');
			found = true;
		});
		if (!found) {
			$(group).append(radiocopy);
		}
		if (kdf.form.readonly) {
			$(group).find(':radio:not(:checked)').attr('disabled',true);
		}
		/*
		$(group).find('input').unbind('change').change(function() {
			$( '#dform_'+kdf.name ).trigger('_KDF_optionSelected', [ kdf, fieldid, $("label[for='"+$(this).attr('id')+"']").text(), $(this).val() ] );
		});
		*/
		paginateRadio(group,false);
	}

	function paginateRadio(group) {
		$(group).siblings('.pager').remove();
		var currentPage = 0;
		var numPerPage = Number($(group).attr('data-pagesize'));
		if (numPerPage == 0) {
			numPerPage = 10;
		}
		var numRows = $(group).find('span').length;
		var numPages = Math.ceil(numRows / numPerPage);
		var pager = $('<div class="pager"></div>');
		$(group).unbind('repaginate');
		if (numRows > 0 && numPages > 1) {
			$(group).bind('repaginate', function() {
				$(group).find('span').hide().slice(currentPage * numPerPage, (currentPage + 1) * numPerPage).show();
				$(pager).find('button[data-page='+Math.floor($(group).find('span.selected').index() / numPerPage)+']').addClass('selected');
			});
			$(group).trigger('repaginate');

			for (var page = 0; page < numPages; page++) {
				$(pager).append('<button class="page-number" data-page="'+(page)+'">'+(page + 1)+'</button>');
			}
			$(pager).insertBefore($(group)).find('button.page-number:first').addClass('active');
			$(pager).find('button').unbind('click').click(function() {
				currentPage = Number($(this).attr('data-page'));
				$(group).trigger('repaginate');
				$(this).removeClass('selected').addClass('active').siblings().removeClass('active');
				return false;
			})
			$(group).find('div').click(function() {
				$(pager).find('button').removeClass('selected');
			});

			// Show page that has the selected value
			var selected = $(group).find(':checked');
			if (selected.length > 0) {
				var index = $(selected[0]).parent().index();
				$(pager).find('button[data-page='+Math.floor(index / numPerPage)+']').click();
			}
		}
	}

	function loadSelect(fieldid, data, container) {
		fieldid = $(container).data('name');
		var select = $(container).find('select');
		var value = $(container).attr('data-value');
		$(select).empty();
		$(select).append('<option value=""></option>');
		$.each(data, function(pos) {
			if (this.selected || value == this.value) {
				$(select).append('<option selected="selected" value="'+this.value+'">'+this.label+'</option>');
			} else {
				$(select).append('<option value="'+this.value+'">'+this.label+'</option>');
			}
		});
		if (kdf.form.readonly) {
			$(select).find('option:not(:selected)').attr('disabled',true);
		}
		/*
		$(select).unbind('change').change(function() {
			$( '#dform_'+kdf.name ).trigger('_KDF_optionSelected', [ kdf, fieldid, $(select).find(':selected').text(), $(select).find(':selected').val() ] );
		});
		*/
	}

	function loadTable(tableid, data, table) {
		$(table).find('.dform_tr:not(:first)').remove();
		$.each(data, function() {
			var rowcopy = $('#dform_tablerow_'+tableid).clone();
			$(rowcopy).removeAttr('id');
			$.each(this, function(key,value) {
				rowcopy.find('.dform_td[data-name='+key+']').html(value);
			});
			$(table).append(rowcopy);
		});
		$(table).find('.dform_tr').unbind('click').click(function() {
			var rowvalues = {};
			$(this).find('.dform_td').each(function(index) {
				rowvalues[$(this).attr('data-name')] = $(this).text();
			});
			$( '#dform_'+kdf.name ).trigger('_KDF_rowSelected', [ kdf, tableid, rowvalues ] );
			$(table).find('.dform_tr').removeClass('selected');
			$(this).addClass('selected');
		});
		paginateTable(table);
	}

	function paginateTable(table) {
		$(table).siblings('.pager').remove();
		var currentPage = 0;
		var numPerPage = Number($(table).attr('data-pagesize'));
		if (numPerPage == 0) {
			numPerPage = 10;
		}
		var numRows = $(table).find('.dform_tr').length-1;
		var numPages = Math.ceil(numRows / numPerPage);
		var pager = $('<div class="pager"></div>');
		$(table).unbind('repaginate');
		if (numRows > 0 && numPages > 1) {
			$(table).bind('repaginate', function() {
				$(table).find('.dform_tr:not(:first)').hide().slice(currentPage * numPerPage, (currentPage + 1) * numPerPage).show();
				$(pager).find('button[data-page='+Math.floor($(table).find('.dform_tr.selected').index() / numPerPage)+']').addClass('selected');
			});
			$(table).trigger('repaginate');

			for (var page = 0; page < numPages; page++) {
				$(pager).append('<button class="page-number" data-page="'+(page)+'">'+(page + 1)+'</button>');
			}
			$(pager).insertBefore($(table)).find('button.page-number:first').addClass('active');
			$(pager).find('button').unbind('click').click(function() {
				currentPage = Number($(this).attr('data-page'));
				$(table).trigger('repaginate');
				$(this).removeClass('selected').addClass('active').siblings().removeClass('active');
				return false;
			})
			$(table).find('.dform_tr').click(function() {
				$(pager).find('button').removeClass('selected');
			});
		}
	}

	function triggerFieldSet(element) {
		$(element).trigger('_KDF_fieldChange', [ kdf, element ] );
	}

	function initOnetomany(selector) {
		$(selector).off('click', 'div.otom_delete').on('click', 'div.otom_delete', function() {
			var name = $(this).parent().parent().data('name');
			var child = $(this).closest('[data-type="child"]');
			var pos = $(child).parent().children().index($(child));
			$(this).parent().remove();
			$('#dform_'+kdf.name).trigger('_KDF_childRemoved', [ kdf, name, pos, child ] );
		});

		$(selector).off('click', 'button[data-type="addchild"]').on('click', 'button[data-type="addchild"]', function() {
			var containerid = '.dform_page';
			var otom_child_container = $(this).closest('div[data-type=child]');
			if ($(otom_child_container).length > 0) {
				// Is contained within a child of another one to many
				containerid = '#' + $(otom_child_container).parent().attr('id') + ' > div[data-pos=' + $(otom_child_container).data('pos') + ']';
			}
			clone($(containerid + ' div[data-name='+$(this).attr('data-target')+']'),true);
		});

		$(selector).off('click', 'button[data-type="removechild"]').on('click', 'button[data-type="removechild"]', function() {
			var containerid = '.dform_page';
			var otom_child_container = $(this).closest('div[data-type=child]');
			if ($(otom_child_container).length > 0) {
				// Is contained within a child of another one to many
				containerid = '#' + $(otom_child_container).parent().attr('id') + ' > div[data-pos=' + $(otom_child_container).data('pos') + ']';
			}
			var child = $(containerid + ' div[data-name='+$(this).attr('data-target')+']').children('div[data-type=child]').last();
			var pos = $(containerid + ' div[data-name='+$(this).attr('data-target')+']').children('div[data-type=child]').index(child);
			$(containerid + ' div[data-name='+$(this).attr('data-target')+']').children('div[data-type=child]').last().remove();
			$('#dform_'+kdf.name).trigger('_KDF_childRemoved', [ kdf, $(this).attr('data-target'), pos, child ] );
		});
	}

	function clone(holder,init) {
		var pos=0;
		var holderid='', holdername='', parentid='', parentname='';
		var hasparent=false;

		$.fn.reverse=[].reverse;
		$(holder).parents('div[data-type=onetomany]').reverse().each(function(index) {
			holdername=$(this).data('name');
			pos=$(holder).closest('.onetomany-'+holdername).data('pos');
			if (index == 0) {
				parentname += holdername+'['+pos+']';
			} else {
				parentname += '['+holdername+'['+pos+']]';
			}
			parentid += holdername+pos;
			hasparent=true;
		});

		holderid=$(holder).attr('id');
		holdername=$(holder).data('name');

		var clone=$('#'+$(holder).data('child')).clone();

		//EMPRO-1261: use the data-pos attribute of the child element to get the pos. This ensures that the pos numbers are unique and increment off the highest number
		var child = $(holder).children('div[data-type=child]').last();
		if(child.length>0) {
			pos = Number($(child).attr('data-pos'))+1;
		} else {
			pos = 0;
		}
		$('#'+$(holder).attr('id')+' .'+holderid).each(function() {
			if (Number($(this).data('pos')) > pos) {
				pos = Number($(this).data('pos'))+1;
			}
		});

		$(clone).find('div, button, input, select, textarea').each(function() {
			var id=$(this).attr('id');
			if ($(this).attr('id')) {
				$(this).attr('id',parentid+holdername+pos+id);
			}
			if ($(this).attr('type') == 'file') {
				$(clone).find('#'+id+'_progressbar').attr('id',parentid+holdername+pos+id+'_progressbar');
				//OFORMS-113: do not alter the id of the files widget - unneccessary
				//$(clone).find('#'+id+'_files').attr('id',parentid+holdername+pos+id+'_files');
			}
		});

		$(clone).find('label').each(function() {
			$(this).attr('for',parentid+holdername+pos+$(this).attr('for'));
		});

		$(clone).find('input, select, textarea').each(function() {
			if (hasparent) {
				$(this).attr('name',parentname+'['+holdername+'['+pos+']]['+$(this).attr('name')+']');
			} else {
				$(this).attr('name',holdername+'['+pos+']['+$(this).attr('name')+']');
			}
			if($(this).attr('type') == 'date') {
				if($(this).data('condition') && $(this).data('condition').match(/\*/)) {
					var newcond = '';
					var condStr = $(this).data('condition');
					var condition = {
						operator: condStr.substring(0, condStr.lastIndexOf(':')),
						fieldone: condStr.substring(condStr.lastIndexOf(':')+1,((condStr.lastIndexOf('|') >=0) ? condStr.lastIndexOf('|') : condStr.length)).trim(),
						fieldtwo: condStr.substring(((condStr.lastIndexOf('|') >=0) ? condStr.lastIndexOf('|')+1 : condStr.length)).trim()
					};

					if(condition.fieldone.match(/^\*/)) {
						newcond = condition.operator+': '+parentid+holdername+pos+'dform_widget_'+condition.fieldone.replace(/\*/g, '');
					} else {
						newcond = condition.operator+': dform_widget_'+condition.fieldone;
					}

					if(condition.fieldtwo) {
						newcond += ' | ';
						if(condition.fieldtwo.match(/^\*/)) {
							newcond += parentid+holdername+pos;
						}
							newcond += 'dform_widget_'+condition.fieldtwo.replace(/\*/g, '');
					}
					$(this).attr('data-condition', newcond);

				}
			}
		});

		$(holder).append('<div class="onetomany-'+holdername+' '+holderid+' '+holderid+'_'+pos+'" data-type="child" data-pos="'+pos+'">'+$(clone).html()+'</div>');
		if (init) {
			$('.'+holderid+'_'+pos).find('div[data-type="gis"]').each(function() {
				initialiseGIS(this);
			});
			$('.'+holderid+'_'+pos).find('div[data-type="funnelback"]').each(function() {
				initialiseFunnelback(this);
			});
			modernize('.'+holderid+'_'+pos);
			initFileUpload('.'+holderid+'_'+pos);
			initButtonLogic('.'+holderid+'_'+pos);
			var elements = $('.'+holderid+'_'+pos).find('input, select, textarea');
			$.each(elements, function() {
				var element = this;
				var value = $(element).closest('.dform_widget_field').attr('data-value');
				if (value) {
					var type=$(element).prop('tagName').toLowerCase();
					if (type == 'input')
						type=$(element).attr('type');
					switch (type) {
						case 'radio':
							if ($(element).attr('value') == value) {
								$(this).prop('checked', true);
								processLogicRadio(this);
								triggerFieldSet(this);
							}
							break;
						case 'checkbox':
							if (value instanceof Array) {
								if ($.inArray(this.value, value) >= 0) {
									$(element).attr('checked', 'checked');
									triggerFieldSet(element);
								}
							} else {
								$(element).attr('checked', 'checked');
								processLogicCheckbox(element);
								triggerFieldSet(element);
							}
							break;
						case 'select':
							$(element).val(value);
							processLogicSelect(element);
							triggerFieldSet(element);
							break;
						case 'span':
							$(element).html(value);
							break;
						default:
							$(element).val(value);
							triggerFieldSet(element);
							break;
					}
				}
			});

		}

		$(holder).removeClass('dform_otomerror');
		$(holder).removeClass('dform_otomerrorCustom');

		$(holder).siblings('.dform_validationMessage').hide();

		$('#dform_'+kdf.name).trigger('_KDF_childAdded', [ kdf, holdername, '.'+holderid+'_'+pos] );
	}

	function checkOnetomany(holder,custom) {
		var errorClass = 'dform_otomerror';
		if (custom)
			errorClass = 'dform_otomerrorCustom';

		$(holder).removeClass('dform_otomerror');
		$(holder).removeClass('dform_otomerrorCustom');

		$(holder).siblings('.dform_validationMessage').hide();

		if ($(holder).hasClass('dform_hidden'))
			return true;

		var id = $(holder).attr('id');
		var min = Number($(holder).data('min'));
		var max = Number($(holder).data('max'));

		if ((min != 0 || max != 0)) {
			var count = $('#'+id+' .'+id).length;
			if ((min != 0 && count < min) || (max != 0 && count > max)) {
				$(holder).addClass(errorClass);
				$(holder).siblings('.dform_validationMessage').show();
				return false;
			}
		}
		return true;
	}



	// Navigation

	function initNavigation() {
		kdf.navWidth=$('#dform_pagenav').attr('class');
		try {kdf.pageWidth=$('#dform_pageholder').attr('class').replace('last','').trim();} catch (err) {}

		$('#dform_pageholder div[data-type="page"]').each(function() {
			if ($(this).attr('data-access') != undefined && $(this).attr('data-access') != kdf.access) {
				$(this).attr('data-active','false');
			}
		});

		$('#dform_navigation li').each(function() {
			if ($('.dform_page[data-pos="'+$(this).attr('data-pos')+'"]').attr('data-active') == 'false') {
				$(this).hide();
			}
		});
		$('#dform_navigation li').unbind('click').click(function() {
			gotoPage($(this).attr('data-pos'),false,true,true);
		});
		$('button[data-type="next"]').unbind('click').click(function() {
			processLogicButton(this);
			gotoNextPage();
		});
		$('button[data-type="prev"]').unbind('click').click(function() {
			processLogicButton(this);
			gotoPrevPage();
		});
		$('button[data-type="move"]').unbind('click').click(function() {
			processLogicButton(this);
			gotoPage($(this).attr('data-moveto'),Number($('#dform_page_'+$(this).attr('data-moveto')).attr('data-pos')) > Number(kdf.form.currentpage) ? true : false,true,true);
		});
		$('#dform_togglenav').unbind('click').click(function() {
			if ($('#dform_navigation').is(':visible')) {
				hideNav();
			} else {
				showNav();
			}
		});
		$('#dform_files_link').unbind('click').click(function() {
			$('#dform_files').toggle();
		});
	}

	function hideNav() {
		$('#dform_navigation').hide();
		$('#dform_pagenav').removeClass(kdf.navWidth);
		$('#dform_pagenav').hide();
		$('#dform_pageholder').removeClass(kdf.pageWidth);
		$('#dform_pageholder').addClass('twelve');
	}

	function showNav() {
		$('#dform_navigation').show();
		$('#dform_pagenav').addClass(kdf.navWidth);
		$('#dform_pagenav').show();
		$('#dform_pageholder').removeClass('twelve');
		$('#dform_pageholder').addClass(kdf.pageWidth);
	}

	function hideControls() {
		$('#dform_controls').hide();
	}

	function showControls() {
		$('#dform_controls').show();
	}

	function gotoNextPage() {
		var gotoid=Number(kdf.form.currentpage)+1;
		while (true) {
			if ($('.dform_page[data-pos="'+gotoid+'"]').attr('data-active') == 'true') {
				break;
			} else {
				gotoid++;
			}
			if (gotoid > 1000) {
				gotoid=1;
				break;
			}
		}
		gotoPage(gotoid,true,true,true);
	}

	function gotoPrevPage() {
		var gotoid=Number(kdf.form.currentpage)-1;
		while (true) {
			if ($('.dform_page[data-pos="'+gotoid+'"]').attr('data-active') == 'true') {
				break;
			} else {
				gotoid--;
			}
			if (gotoid <= 0) {
				gotoid=1;
				break;
			}
		}
		gotoPage(gotoid,false,true,true);
	}
	
	function gotoPage(gotoid,checkform,clearmessages,pushhistory) {
		if (isNaN(gotoid)) {
			gotoid = Number($('#dform_page_'+gotoid).attr('data-pos'));
		}
		
		if ($('.dform_page[data-pos="'+gotoid+'"]').attr('data-active') == 'false') {
			gotoNextPage();
			return;
		}
		if (clearmessages)
			hideMessages();
		if (checkform) {
			if (check('.dform_page[data-pos="'+kdf.form.currentpage+'"]') != 0) {
				$('#dform_navigation li[data-pos="'+kdf.form.currentpage+'"]').removeClass('dform_pageValid dform_pageInvalidCustom').addClass('dform_pageInvalid');
				return;
			} else {
				$('#dform_navigation li[data-pos="'+kdf.form.currentpage+'"]').removeClass('dform_pageInvalid dform_pageInvalidCustom').addClass('dform_pageValid');
				if (gotoid == kdf.pages && checkProgress() != 0) {
					showError(kdf.messages.checkFormMsg);					
					showNav();
					return;
				}
			}
		}
		
		var navaction = $('.dform_page[data-pos="'+gotoid+'"]').attr('data-navaction');
		switch(navaction) {
			case 'enablenav':
				showNav();
				break;
			case 'disablenav':
				hideNav();
				break;
			case 'enablecon':
				showControls();
				break;
			case 'disablecon':
				hideControls();
				break;
			case 'enablenavcon':
				showNav();
				showControls();
				break;	
			case 'disablenavcon':
				hideNav();
				hideControls();
				break;
		}		
		
		$('div[data-type="page"]').hide();
		$('#dform_navigation li').removeClass('selected');
		$('#dform_navigation li[data-pos="'+gotoid+'"]').addClass('selected');
		$('.dform_page[data-pos="'+gotoid+'"]').show();
		$('#dform_'+kdf.name).trigger('_KDF_pageChange', [ kdf, kdf.form.currentpage, gotoid ] );
		kdf.form.currentpage=gotoid;
		if (gotoid == kdf.pages) {
			save();
		}
		updateProgress();

		$('.dform_page[data-pos="'+kdf.form.currentpage+'"] div[data-type="gis"]').each(function() {
			initialiseGIS(this);
		});

		$('.dform_page[data-pos="'+kdf.form.currentpage+'"] div[data-type="funnelback"]').each(function() {
			initialiseFunnelback(this);
		});

		scrollTop();
		parseHtml();

		if(pushhistory && kdf.history != undefined) {
			if (kdf.history.getCurrentIndex() <= 0) {
				kdf.history.replaceState({page: kdf.form.currentpage, rand: Math.random()}, '', '');
			} else {
				kdf.history.pushState({page: kdf.form.currentpage, rand: Math.random()}, '', '');
			}
		}

		if($('.dform_page[data-pos="'+gotoid+'"]').attr('data-startaction')) {
			custom($('.dform_page[data-pos="'+gotoid+'"]').attr('data-startaction'), 'page_start_action ', '#dform_'+kdf.name, '', false, true, true);
			$('.dform_page[data-pos="'+gotoid+'"]').removeAttr('data-startaction');
		}
	}

	function parseHtml() {
		$('.dform_page[data-pos="'+kdf.form.currentpage+'"] span[data-mapfrom]').each(function() {
			var span = this;
			$(span).html('');
			var mapfrom = $(':input[name="'+$(this).attr('data-mapfrom')+'"]');
			if (!mapfrom.length) {
				mapfrom = $(':input[name="'+$(this).attr('data-mapfrom')+'[]"]');
			}

			if (mapfrom.length == 1) {
				var type=$(mapfrom).prop('tagName').toLowerCase();
				if (type == 'input')
					type=$(mapfrom).attr('type');

				switch (type) {
					case 'radio':
						if ($(mapfrom).is(':checked')) {
							$(span).html($('label[for="'+$(mapfrom).attr('id')+'"]').text());
						}
						break;
					case 'checkbox':
						if ($(mapfrom).is(':checked')) {
							$(span).html($(mapfrom).val());
						} else {
							$(span).html($(mapfrom).attr('data-unchecked-value'));
						}
						break;
					case 'select':
						$(span).html($('#'+$(mapfrom).attr('id')).find('option:selected').text());
						break;
					case 'file':
						$(span).html('<span class="dform_filenames">'+$('#'+$(mapfrom).attr('id')+'_files').html()+'</span>');
						//TODO
						break;
					case 'date':
						$(span).html(convertDate($(mapfrom).val(),kdf.dateformat));
						break;
					default:
						$(span).html(escapeHtml($(mapfrom).val()));
						break;
				}
			} else if (mapfrom.length > 1) {
				$.each(mapfrom, function() {
					var type=$(this).attr('type');
					switch (type) {
						case 'radio':
							if ($(this).is(':checked')) {
								$(span).html($('label[for="'+$(this).attr('id')+'"]').text());
							}
							break;
						case 'checkbox':
							if ($(this).is(':checked')) {
								if ($(span).html() == '') {
									$(span).html($('label[for="'+$(this).attr('id')+'"]').text());
								} else {
									$(span).append(', '+$('label[for="'+$(this).attr('id')+'"]').text());
								}
							}
							break;
					}
				});
			}
		});
	}

	function escapeHtml(unsafe) {
		return unsafe
			 .replace(/&/g, "&amp;")
			 .replace(/</g, "&lt;")
			 .replace(/>/g, "&gt;")
			 .replace(/"/g, "&quot;")
			 .replace(/'/g, "&#039;");
	 }

	function updateProgress() {
		var activepages = $('.dform_page[data-active="true"]').length;
		var curpos = $('.dform_page[data-active="true"]:visible').index('.dform_page[data-active="true"]')+1;
		if (curpos == 0)
			curpos = 1;
		var perc = (100/activepages)*curpos;
		$('#dform_progressbar').html('<div style="width: '+perc+'%;"></div>');
	}



	// Logic

	function initLogic(selector) {
		$(selector).off('change', ':checkbox').on('change', ':checkbox', function() {
			processLogicCheckbox(this);
		});
		$(selector).off('change', ':radio').on('change', ':radio', function() {
			processLogicRadio(this);
		});
		$(selector).off('change', 'select').on('change', 'select', function() {
			processLogicSelect(this);
		});
		$(selector).off('change', 'input[data-forcecase="upper"]').on('change', 'input[data-forcecase="upper"]', function() {
			$(this).val($(this).val().toUpperCase());
		});
		$(selector).off('change', 'input[data-forcecase="lower"]').on('change', 'input[data-forcecase="lower"]', function() {
			$(this).val($(this).val().toLowerCase());
		});
		$(selector).find('button[data-type="custom"]').unbind('click').click(function() {
			processRequiredLogicButton(this);
			custom($(this).data('action'), $(this).attr('id'), $(this).data('selector'), $(this).data('required'), true, true, true);
		});
		$(selector).find('button[data-type="customobject"]').unbind('click').click(function() {
			processRequiredLogicButton(this);
			custom($(this).data('action'), $(this).attr('id'), $(this).data('selector'), $(this).data('required'), true, false, true);
		});
		$(selector).find('button[data-type="searchwidget"]').unbind('click').click(function() {
			processRequiredLogicButton(this);
			searchwidget($(this).data('action'), $(this).data('widgetname'));
		});
		$('#dform_'+kdf.name).unbind('submit').submit(function (event) {
			if ($('button[data-type="custom"]:visible').length == 1) {
				$('button[data-type="custom"]:visible').click();
			} else if ($('button[data-type="customobject"]:visible').length == 1) {
				$('button[data-type="customobject"]:visible').click();
			}
			event.preventDefault();
		});
	}

	function initButtonLogic(selector) {
		$(selector).find('button[data-page-on], button[data-page-off], button[data-section-on], button[data-section-off], button[data-on], button[data-off], button[data-required-on], button[data-required-off]')
				   .unbind('click').click(function() {
			processLogicButton(this);
		});
	}

	function disableLogic(selector) {
		$(selector).off('change', ':checkbox');
		$(selector).off('change', ':radio');
		$(selector).off('change', 'select');
		$(selector).find('button[data-type="custom"]').unbind('click');
	}

	function processLogicCheckbox(element) {
		togglePages(element,$(element).attr('data-toggle-page'));
		toggleSections(element,$(element).attr('data-toggle-section'));
		toggle(element,$(element).attr('data-toggle'));
		toggleRequired(element,$(element).attr('data-toggle-required'));
		$( '#dform_' + kdf.name ).trigger('_KDF_optionSelected', [ kdf, $(element).attr('name'), $("label[for='" + $(element).attr('id') + "']").text(), $(element).is(':checked') ? $(element).val() : '' ] );
	}

	function processLogicRadio(element) {
		hide(element,$(element).attr('data-off'));
		hidePages(element,$(element).attr('data-page-off'));
		showPages(element,$(element).attr('data-page-on'));
		hideSections(element,$(element).attr('data-section-off'));
		showSections(element,$(element).attr('data-section-on'));
		show(element,$(element).attr('data-on'));
		setNotRequired(element,$(element).attr('data-required-off'));
		setRequired(element,$(element).attr('data-required-on'));
		$( '#dform_' + kdf.name ).trigger('_KDF_optionSelected', [ kdf, $(element).attr('name'), $("label[for='" + $(element).attr('id') + "']").text(), $(element).val() ] );
	}

	function processLogicSelect(element) {
		hide(element,$('option:selected', element).attr('data-off'));
		hidePages(element,$('option:selected', element).attr('data-page-off'));
		showPages(element,$('option:selected', element).attr('data-page-on'));
		hideSections(element,$('option:selected', element).attr('data-section-off'));
		showSections(element,$('option:selected', element).attr('data-section-on'));
		show(element,$('option:selected', element).attr('data-on'));
		setNotRequired(element,$('option:selected', element).attr('data-required-off'));
		setRequired(element,$('option:selected', element).attr('data-required-on'));
		$( '#dform_' + kdf.name ).trigger('_KDF_optionSelected', [ kdf, $(element).attr('name'), $(element).find(':selected').text(), $(element).val() ] );
	}

	function processLogicButton(element) {
		hide(element,$(element).attr('data-off'));
		hidePages(element,$(element).attr('data-page-off'));
		showPages(element,$(element).attr('data-page-on'));
		hideSections(element,$(element).attr('data-section-off'));
		showSections(element,$(element).attr('data-section-on'));
		show(element,$(element).attr('data-on'));
		setNotRequired(element,$(element).attr('data-required-off'));
		setRequired(element,$(element).attr('data-required-on'));
	}

	function processRequiredLogicButton(element) {
		setNotRequired(element,$(element).attr('data-required-off'));
		setRequired(element,$(element).attr('data-required-on'));
	}

	function resetLogicFields(element) {
		$(element).find('input,select').each(function() {
			var type= $(this).attr('type');
			if (!type) {
				 type = $(this).prop('tagName').toLowerCase();
			}
			switch (type) {
				case 'radio':
					hide(element,$('input[name="'+$(this).attr('name')+'"]:checked').attr('data-on'));
					hidePages(element,$('input[name="'+$(this).attr('name')+'"]:checked').attr('data-page-on'));
					hideSections(element,$('input[name="'+$(this).attr('name')+'"]:checked').attr('data-section-on'));
					setNotRequired(element,$('input[name="'+$(this).attr('name')+'"]:checked').attr('data-required-on'));
					$('input[name="'+$(this).attr('name')+'"]').attr('checked',false);
					break;
				case 'checkbox':
					$('input[name="'+$(this).attr('name')+'"]').attr('checked',false);
					processLogicCheckbox(this)
					break;
				case 'select':
					hide(element,$('option:selected', element).attr('data-on'));
					hidePages(element,$('option:selected', element).attr('data-page-on'));
					hideSections(element,$('option:selected', element).attr('data-section-on'));
					setNotRequired(element,$('option:selected', element).attr('data-required-on'));
					$(this).val('');
					break;
				default:
					break;
			}
		});
	}

	function show(element,widgetlist) {
		if (widgetlist) {
			var parent = $(element).parents('div[data-type="child"]').first();
			if (parent.length <= 0) {
				parent = $('#dform_'+kdf.name);
			}
			var widgets=widgetlist.split(',');
			for (var i=0; i < widgets.length; i++) {
				$(parent).find('.dform_widget_'+widgets[i].trim()).removeClass('dform_hidden');
				$(parent).find('.dform_widget_'+widgets[i].trim()).each(function() {
					if ($(this).prop('tagName') == 'OPTION') {
						$(this).attr('disabled',false);
						if($(this).parent('span.dform_hidden').length) {
							$(this).unwrap();
						}
					}

					$(this).find('div[data-type="gis"]').each(function() {
						initialiseGIS(this);
					});

					if ($(this).data('type') == 'funnelback') {
						initialiseFunnelback(this);
					}
				});
			}
		}
	}

	function showWidget(widget) {
		$('.dform_widget_'+widget).removeClass('dform_hidden');
		$('.dform_widget_'+widget).find('div[data-type="gis"]').each(function() {
			initialiseGIS(this);
		});

		if ($('.dform_widget_'+widget).data('type') == 'funnelback') {
			initialiseFunnelback($('.dform_widget_'+widget));
		}
	}

	function hide(element,widgetlist) {
		if (widgetlist) {
			var parent = $(element).parents('div[data-type="child"]').first();
			if (parent.length <= 0) {
				parent = $('#dform_'+kdf.name);
			}
			var widgets=widgetlist.split(',');
			for (var i=0; i < widgets.length; i++) {
				$(parent).find('.dform_widget_'+widgets[i].trim()).each(function() {
					$(this).addClass('dform_hidden');
					if ($(this).prop('tagName') == 'OPTION') {
						if ($(this).parent().val() == $(this).val()) {
							$(this).parent().val('');
						}
						if(!$(this).parent('span.dform_hidden').length) {
							$(this).wrap('<span class="dform_hidden"/>');
						}
						$(this).attr('disabled',true);
					}
					resetLogicFields(this);
				});
				resetLogicFields();
			}
		}
	}

	function hideWidget(widget) {
		$('.dform_widget_'+widget).addClass('dform_hidden');
	}

	function setRequired(element,widgetlist) {
		if (widgetlist) {
			var parent = $(element).parents('div[data-type="child"]').first();
			if (parent.length <= 0) {
				parent = $('#dform_'+kdf.name);
			}
			var widgets=widgetlist.split(',');
			for (var i=0; i < widgets.length; i++) {
				$(parent).find('.dform_widget_'+widgets[i].trim()).find('input, select, textarea').prop('required',true);
				$(parent).find('.dform_widget_'+widgets[i].trim()).each(function() {
					if ($(this).attr('data-type') == 'gis') {
						initialiseGIS(this);
						$(this).attr('data-required',true);
					}
				});
			}
		}
	}

	function setWidgetRequired(widget) {
		$('.dform_widget_'+widget).find('input, select, textarea').prop('required',true);
	}

	function setNotRequired(element,widgetlist) {
		if (widgetlist) {
			var parent = $(element).parents('div[data-type="child"]').first();
			if (parent.length <= 0) {
				parent = $('#dform_'+kdf.name);
			}
			var widgets=widgetlist.split(',');
			for (var i=0; i < widgets.length; i++) {
				$(parent).find('.dform_widget_'+widgets[i].trim()).find('input, select, textarea').prop('required',false).removeClass('dform_fielderror');
				$(parent).find('.dform_widget_'+widgets[i].trim()).find('.dform_validationMessage').hide();
				$(parent).find('.dform_widget_'+widgets[i].trim()).each(function() {
					if ($(this).attr('data-type') == 'gis') {
						$(this).attr('data-required',false).removeClass('dform_maperror');
						$(this).siblings('.dform_validationMessage').hide();
					}
				});
			}
		}
	}

	function setWidgetNotRequired(widget) {
		$('.dform_widget_'+widget).find('input, select, textarea').prop('required',false);
	}

	function showPages(element,pagelist) {
		if (pagelist) {
			var pages=pagelist.split(',');
			for (var i=0; i < pages.length; i++) {
				var access = $('#dform_page_'+pages[i].trim()).data('access');
				if (access == undefined || access == kdf.access) {
					$('#dform_navigation li[data-pos="'+$('#dform_page_'+pages[i].trim()).attr('data-pos')+'"]').show();
					$('#dform_page_'+pages[i].trim()).removeClass('dform_hidden').attr('data-active','true');
				}
			}
		}
		updateProgress();
	}

	function showPage(page) {
		var access = $('#dform_page_'+page).data('access');
		if (access == undefined || access == kdf.access) {
			$('#dform_pagenav_'+page).show();
			$('#dform_page_'+page).removeClass('dform_hidden').attr('data-active','true');
		}
	}

	function hidePages(element,pagelist) {
		if (pagelist) {
			var pages=pagelist.split(',');
			for (var i=0; i < pages.length; i++) {
				$('#dform_navigation li[data-pos="'+$('#dform_page_'+pages[i].trim()).attr('data-pos')+'"]').hide();
				$('#dform_page_'+pages[i].trim()).addClass('dform_hidden').attr('data-active','false');
			}
		}
		updateProgress();
	}

	function hidePage(page) {
		$('#dform_pagenav_'+page).hide();
		$('#dform_page_'+page).addClass('dform_hidden').attr('data-active','false');
	}

	function togglePages(element,pagelist) {
		if (pagelist) {
			var pages = pagelist.split(',');
			for (var i=0; i < pages.length; i++) {
				if($('#dform_page_'+pages[i].trim()).hasClass('dform_hidden')) {
					var access = $('#dform_page_'+pages[i].trim()).data('access');
					if (access == undefined || access == kdf.access) {
						$('#dform_navigation li[data-pos="'+$('#dform_page_'+pages[i].trim()).attr('data-pos')+'"]').show();
						$('#dform_page_'+pages[i].trim()).removeClass('dform_hidden').attr('data-active','true');
					}
				} else {
					$('#dform_navigation li[data-pos="'+$('#dform_page_'+pages[i].trim()).attr('data-pos')+'"]').hide();
					$('#dform_page_'+pages[i].trim()).addClass('dform_hidden').attr('data-active','false');
				}
			}
		}
		updateProgress();
	}

	function showSections(element,sectionlist) {
		if (sectionlist) {
			var parent = $(element).parents('div[data-type="child"]').first();
			if (parent.length <= 0) {
				parent = $('#dform_'+kdf.name);
			}
			var sections=sectionlist.split(',');
			for (var i=0; i < sections.length; i++) {
				$(parent).find('.dform_section_'+sections[i].trim()).removeClass('dform_hidden');
				$(parent).find('.dform_section_'+sections[i].trim()).each(function() {
					$(this).find('div[data-type="gis"]').each(function() {
						initialiseGIS(this);
					});

					$(this).find('div[data-type="funnelback"]').each(function() {
						initialiseFunnelback(this);
					});
				});
			}
		}
	}

	function showSection(section) {
		var access = $('.dform_section_'+section).data('access');
		if (access == undefined || access == kdf.access) {
			$('.dform_section_'+section).removeClass('dform_hidden');
			$('.dform_section_'+section).find('div[data-type="gis"]').each(function() {
				initialiseGIS(this);
			});

			$('.dform_section_'+section).find('div[data-type="funnelback"]').each(function() {
				initialiseFunnelback(this);
			});
		}
	}

	function hideSections(element,sectionlist) {
		if (sectionlist) {
			var parent = $(element).parents('div[data-type="child"]').first();
			if (parent.length <= 0) {
				parent = $('#dform_'+kdf.name);
			}
			var sections=sectionlist.split(',');
			for (var i=0; i < sections.length; i++) {
				$(parent).find('.dform_section_'+sections[i].trim()).each(function() {
					$(this).addClass('dform_hidden');
				});
			}
		}
	}

	function hideSection(section) {
		$('.dform_section_'+section).addClass('dform_hidden').attr('data-active','false');
	}

	function toggleSections(element,sectionlist) {
		if (sectionlist) {
			var sections = sectionlist.split(',');
			for (var i=0; i < sections.length; i++) {
				if($('.dform_section_'+sections[i].trim()).hasClass('dform_hidden')) {
					var access = $('.dform_section_'+sections[i].trim()).data('access');
					if (access == undefined || access == kdf.access) {
						$('.dform_section_'+sections[i].trim()).removeClass('dform_hidden').attr('data-active','true');
					}
				} else {
					$('.dform_section_'+sections[i].trim()).addClass('dform_hidden').attr('data-active','false');
				}
			}
		}
	}

	function toggle(element,widgetlist) {
		if (widgetlist) {
			var parent = $(element).parents('div[data-type="child"]').first();
			if (parent.length <= 0) {
				parent = $('#dform_'+kdf.name);
			}
			var widgets=widgetlist.split(',');
			for (var i=0; i < widgets.length; i++) {
				$(parent).find('.dform_widget_'+widgets[i].trim()).each(function() {
					if ($(this).hasClass('dform_hidden')) {
						$(this).removeClass('dform_hidden');
						$(this).each(function() {
							$(this).find('div[data-type="gis"]').each(function() {
								initialiseGIS(this);
							});
							$(this).find('div[data-type="funnelback"]').each(function() {
								initialiseFunnelback(this);
							});
						});
					} else {
						$(this).addClass('dform_hidden');
						resetLogicFields(this);
					}
				});
			}
		}
	}

	function toggleRequired(element,widgetlist) {
		if (widgetlist) {
			var parent = $(element).parents('div[data-type="child"]').first();
			if (parent.length <= 0) {
				parent = $('#dform_'+kdf.name);
			}
			var widgets=widgetlist.split(',');
			for (var i=0; i < widgets.length; i++) {
				$(parent).find('.dform_widget_'+widgets[i].trim()).find('input, select, textarea').each(function() {
					if ($(this).prop('required') == true || $(this).prop('required') === '') {
						$(this).prop('required', false).removeClass('dform_fielderror');
						$(this).parent().find('.dform_validationMessage').hide();
					} else {
						$(this).prop('required', true);
					}
				});
				$(parent).find('.dform_widget_'+widgets[i].trim()).find('div[data-type="gis"]').each(function() {
					if ($(this).attr('data-required') == 'true') {
						$(this).attr('data-required', 'false').removeClass('dform_maperror');
						$(this).siblings('.dform_validationMessage').hide();
					} else {
						$(this).attr('data-required', 'true');
					}
				});
			}
		}
	}


	// Validation

	function initRealtimeValidation(selector) {
		$(selector).off('focusout', 'input, select, textarea').on('focusout', 'input, select, textarea', function() {
			if (!kdf.realtimeValidationOn)
				return;
			validateInput(this);
		});
		$(selector).off('change', 'input, select, textarea').on('change', 'input, select, textarea', function() {
			clearFieldError(this, false);
			clearFieldError(this, true);
			triggerFieldSet(this);
		});
		$(selector).off('keydown', 'input, select, textarea').on('keydown', 'input, select, textarea', function() {
			clearFieldError(this, false);
			clearFieldError(this, true);
		});
	}

	function calculateActiveFields() {
		$('#dform_'+kdf.name).find('input, select, textarea').addClass('dform_field_active');
		$('#dform_'+kdf.name).find('.dform_hidden input, .dform_hidden select, .dform_hidden textarea, input.dform_ignore, select.dform_ignore, textarea.dform_ignore').removeClass('dform_field_active');

		var hiddenaccess = kdf.access === 'agent' ? 'citizen' : 'agent';
		$('#dform_'+kdf.name).find('[data-access="'+hiddenaccess+'"] input, [data-access="'+hiddenaccess+'"] select, [data-access="'+hiddenaccess+'"] textarea').removeClass('dform_field_active');
	}

	function checkProgress() {
		hideMessages();
		calculateActiveFields();
		var errorPageCount=0;
		$('#dform_navigation li').removeClass('dform_pageInvalid dform_pageValid');
		$('div[data-type="page"][data-active="true"]').each(function() {
			if (check('#'+$(this).attr('id')) != 0) {
				errorPageCount++;
				$('#dform_navigation li[data-pos="'+$(this).attr('data-pos')+'"]').addClass('dform_pageInvalid');
			} else {
				$('#dform_navigation li[data-pos="'+$(this).attr('data-pos')+'"]').addClass('dform_pageValid');
			}
		});
		return errorPageCount;
	}

	function check(selector) {
		hideMessages();
		calculateActiveFields();

		var errors=0;
		var firstErrorField;

		$('.dform_pageInvalidCustom').removeClass('dform_pageInvalidCustom');
		$('.dform_fielderrorCustom').removeClass('dform_fielderrorCustom');
		$('.dform_maperrorCustom').removeClass('dform_maperrorCustom');

		$(selector).find('.dform_field_active').each(function() {
			if (validateInputRequired(this) != 0) {
				errors++;
				if (errors == 1) {firstErrorField = $(this).attr('id');}
			} else if (validateInputData(this, false) != 0) {
				errors++;
				if (errors == 1) {firstErrorField = $(this).attr('id');}
			} else if (validateInputMaxLength(this) != 0) {
				//TODO
				errors++;
				if (errors == 1) {firstErrorField = $(this).attr('id');}
			}
		});

		$(selector).find('div[data-type="gis"]').each(function() {
			var widgetaccess = $(this).parent().data('access');
			if (widgetaccess == null || widgetaccess == 'all' || widgetaccess == kdf.access) {
				if (!checkGIS(this, false)) {
					errors++;
				}
			}
		});

		$(selector+' fieldset[data-type="search"]').each(function() {
			var widgetaccess = $(this).parent().data('access');
			if (widgetaccess == null || widgetaccess == 'all' || widgetaccess == kdf.access) {
				if (!checkSearchWidget(this)) {
					errors++;
				}
			}
		});

		$(selector).find('div[data-type="onetomany"]').each(function() {
			var widgetaccess = $(this).data('access');
			if (widgetaccess == null || widgetaccess == 'all' || widgetaccess == kdf.access) {
				if (!checkOnetomany(this, false)) {
					errors++;
				}
			}
		});

		if (errors > 0) {$('#'+firstErrorField).focus();}
		return errors;
	}

	function checkCustom(selector, required) {
		hideMessages();
		calculateActiveFields();

		var errors=0;
		var showMessage = false;
		var firstErrorField;

		$('.dform_pageInvalidCustom').removeClass('dform_pageInvalidCustom');
		$('.dform_fielderrorCustom').removeClass('dform_fielderrorCustom');
		$('.dform_maperrorCustom').removeClass('dform_maperrorCustom');

		// Check Custom Required Fields
		$(required).find('.dform_field_active').each(function() {
			if (validateInputRequiredCustomAction(this) != 0) {
				var pagepos = $(this).closest("[data-type='page']").data('pos');
				if(pagepos != kdf.form.currentpage)
					showMessage = true;
				$('#dform_navigation li[data-pos="'+pagepos+'"]').addClass('dform_pageInvalidCustom');
				errors++;
				if (errors == 1) {firstErrorField = $(this).attr('id');}
			}
		});

		//Check Custom Required GIS's
		$(required).find('div[data-type="gis"]').each(function() {
			if (!checkGIS(this, true)) {
				var pagepos = $(this).closest("[data-type='page']").data('pos');
				if(pagepos != kdf.form.currentpage)
					showMessage = true;
				$('#dform_navigation li[data-pos="'+pagepos+'"]').addClass('dform_pageInvalidCustom');
				errors++;
			}
		});

		// Check All Fields For Valid Data (Postcode, Email etc)
		$(selector).find('.dform_field_active').each(function() {
			if (validateInputData(this, true) != 0) {
				var pagepos = $(this).closest("[data-type='page']").data('pos');
				if(pagepos != kdf.form.currentpage)
					showMessage = true;
				$('#dform_navigation li[data-pos="'+pagepos+'"]').addClass('dform_pageInvalidCustom');
				errors++;
				if (errors == 1) {firstErrorField = $(this).attr('id');}
			}
		});

		if (errors > 0) {
			$('#'+firstErrorField).focus();
			if(showMessage)
				showWarning(kdf.messages.checkFormMsg);
		}

		return errors;
	}


	function validateField(name) {
		validateInput($('.dform_widget_'+name+ ' :input'));
	}

	function validateInput(input) {
		clearFieldError(input, false);
		if (validateInputRequired(input) == 0) {
			validateInputData(input, false);
		}
	}

	function validateInputRequired(input) {
		var errors=0;
		if ($(input).prop('required') == true || $(input).prop('required') === '') {
			var type= $(input).attr('type');
			switch (type) {
				case 'radio':
					if (!$('input[name="'+$(input).attr('name')+'"]').is(':checked')) {
						showFieldError(input, false);
						errors++;
					}
					break;
				case 'checkbox':
					if (!$('input[name="'+$(input).attr('name')+'"]').is(':checked')) {
						showFieldError(input, false);
						errors++;
					}
					break;
				case 'file':
					if ($('#'+$(input).attr('id')+'_files span').length == 0) {
						showFieldError(input, false);
						errors++;
					}
					break;
				default:
					if ($(input).val() == '' || !$(input).val()) {
						showFieldError(input, false);
						errors++;
					}
					break;
			}
		}
		return errors;
	}

	function validateInputRequiredCustomAction(input) {
		var errors=0;
		var type= $(input).attr('type');
		switch (type) {
			case 'radio':
				if (!$('input[name="'+$(input).attr('name')+'"]').is(':checked')) {
					showFieldError(input, true);
					errors++;
				}
				break;
			case 'checkbox':
				if (!$('input[name="'+$(input).attr('name')+'"]').is(':checked')) {
					showFieldError(input, true);
					errors++;
				}
				break;
			case 'file':
				if ($('#'+$(input).attr('id')+'_files span').length == 0) {
					showFieldError(input, true);
					errors++;
				}
				break;
			default:
				if ($(input).val() == '' || !$(input).val()) {
					showFieldError(input, true);
					errors++;
				}
				break;
		}

		return errors;
	}

	function validateInputRequiredWidgetAction(input) {
		var errors=0;
		var type= $(input).attr('type');
		if ($(input).val() == '' || !$(input).val()) {
			showFieldError(input, true);
			errors++;
		}
		return errors;
	}

	function validateInputMaxLength(input) {
		var errors=0;
		if($(input).attr('maxlength')){
			if($(input).val().length > $(input).attr('maxlength')) {
				showFieldError(input, false);
				errors++;
			}
		}
		return errors;
	}

	function validateInputData(input, custom, depth) {
		var errors=0;
		if ($(input).val() != '') {
			var type= $(input).attr('type');
			switch (type) {
				case 'number':
					if (isNaN($(input).val())) {
						errors++;
					} else {
						if ($(input).prop('min')) {
							if (Number($(input).val()) < Number($(input).prop('min'))) {
								errors++;
							}
						}
						if ($(input).prop('max')) {
							if (Number($(input).val()) > Number($(input).prop('max'))) {
								errors++;
							}
						}
						if ($(input).prop('pattern')) {
							var patternRegex=new RegExp($(input).prop('pattern'));
							if (!patternRegex.test($(input).val())) {
								errors++;
							}
						}
						if($(input).prop('step')) {
							// If either value or step is a decimal handle it, else do it normally
							// If a number does not equal itself floored then it is a decimal
							if ($(input).val() != Math.floor($(input).val()) || $(input).prop('step') != Math.floor($(input).prop('step'))) {
								if(($(input).val() * 1000) % ($(input).prop('step')  * 1000) !== 0) {
									errors++;
								}
							} else {
								if($(input).val() % $(input).prop('step') !== 0) {
									errors++;
								}
							}
						}
					}
					break;
				case 'date':
					var inputval = $(input).val();
					if($(input).hasClass('hasDatepicker')) {
						inputval = $(input).siblings('input[type=date]').val();
					}

					if (!isDate(inputval)) {
						errors++;
					} else {
						if ($(input).prop('min')) {
							if ($(input).prop('min').length == 10) {
								if (!validateDate($(input).prop('min'), inputval, 'min')) {
									errors++;
								}
							}
						}
						if ($(input).prop('max')) {
							if ($(input).prop('max').length == 10) {
								if (!validateDate($(input).prop('max'), inputval, 'max')){
									errors++;
								}
							}
						}
						if($(input).data('condition')) {
							var condStr = $(input).data('condition');
							var condition = {
								operator: condStr.substring(0, condStr.lastIndexOf(':')),
								fieldone : {
									prefix:'',
									name: condStr.substring(condStr.lastIndexOf(':')+1,((condStr.lastIndexOf('|') >=0) ? condStr.lastIndexOf('|') : condStr.length)).trim(),
									value: null},
								fieldtwo : {
									prefix:'',
									name: condStr.substring(((condStr.lastIndexOf('|') >=0) ? condStr.lastIndexOf('|')+1 : condStr.length)).trim(),
									value: null}
							};

							condition.fieldone.prefix = getDateFieldPrefix(condition.fieldone.name);
							if (!Modernizr.inputtypes.date) {
								condition.fieldone.value = $(condition.fieldone.prefix+condition.fieldone.name).siblings('input[type="date"]').val();
							} else {
								condition.fieldone.value = $(condition.fieldone.prefix+condition.fieldone.name).val();
							}

							if(condition.fieldtwo.name) {
								condition.fieldtwo.prefix = getDateFieldPrefix(condition.fieldtwo.name);
								if (!Modernizr.inputtypes.date) {
									condition.fieldtwo.value = $(condition.fieldtwo.prefix+condition.fieldtwo.name).siblings('input[type="date"]').val();
								} else {
									condition.fieldtwo.value = $(condition.fieldtwo.prefix+condition.fieldtwo.name).val();
								}
							}

							if(condStr.indexOf('|') > -1) {
								if(inputval !='' && condition.fieldone.value && condition.fieldtwo.value){
									if (!validateDateCondition(inputval, condition.operator, condition.fieldone.value, condition.fieldtwo.value)) {
										errors++;
										if(!$(input).closest('div[data-type=page]').is(':visible')) {
											$('#dform_navigation li[data-pos="'+$(input).closest('div[data-type=page]').data('pos')+'"]').addClass('dform_pageInvalid');
										}
									} else {
										if(!$(input).closest('div[data-type=page]').is(':visible')) {
											$('#dform_navigation li[data-pos="'+$(input).closest('div[data-type=page]').data('pos')+'"]').removeClass('dform_pageInvalid');
										}
										if(errors == 0) {
											clearFieldError($(input), false);
										}
									}
								}
							} else {
								if(inputval !='' && condition.fieldone.value){
									if (!validateDateCondition(inputval, condition.operator, condition.fieldone.value, null)) {
										errors++;
										if(!$(input).closest('div[data-type=page]').is(':visible')) {
											$('#dform_navigation li[data-pos="'+$(input).closest('div[data-type=page]').data('pos')+'"]').addClass('dform_pageInvalid');
										}
									} else {
										if(!$(input).closest('div[data-type=page]').is(':visible')) {
											$('#dform_navigation li[data-pos="'+$(input).closest('div[data-type=page]').data('pos')+'"]').removeClass('dform_pageInvalid');
										}
										if(errors == 0) {
											clearFieldError($(input), false);
										}
									}
								}
							}
						}
						if(!depth) {
							validateDateFields($(input).attr('id'));
						}
					}
					break;
				case 'time':
					var phoneRegex=new RegExp("([0-1]{1}[0-9]{1}|20|21|22|23):[0-5]{1}[0-9]{1}");
					if (!phoneRegex.test($(input).val())) {
						errors++;
					}
					break;
				default:
					if ($(input).prop('pattern')) {
						var patternRegex=new RegExp($(input).prop('pattern'));
						if (!patternRegex.test($(input).val())) {
							errors++;
						}
					}
					break;
			}
		}
		if ($(input).data('matches')) {
			var inputfield = input;
			if ($(inputfield).attr('type') == 'date') {
				if (!Modernizr.inputtypes.date) {
					inputfield = $(input).parent().children(':not(.hasDatepicker):first')[0];
				}
			}
			var matches;
			if ($(inputfield).attr('data-matches').indexOf('dform') >= 0) {
				matches=$('#'+$(inputfield).attr('data-matches')).val();
			} else {
				matches=$('#dform_widget_'+$(inputfield).attr('data-matches')).val();
			}
			if (matches != $(inputfield).val()) {
				errors++;
			}
		}
		if (errors > 0) {
			showFieldError(input, custom);
		}
		return errors;
	}

	function getDateFieldPrefix(condField) {
		var prefix = '#';
		if(condField.match(/^otom_/)) {
			if(!Modernizr.inputtypes.date) {
				prefix += '_JQDP_';
			}

		} else {
			if (!Modernizr.inputtypes.date) {
				prefix += '_JQDP_';
			}
			prefix += 'dform_widget_';
		}
		return prefix;
	}

	function validateDateFields(dateChanged) {
		if(dateChanged.match(/^_JQDP_dform_widget_/)) {
			dateChanged = dateChanged.replace('_JQDP_dform_widget_','');
		}
		if(dateChanged.match(/^_JQDP_/)) {
			dateChanged = dateChanged.replace('_JQDP_','');
		}
		if(dateChanged.match(/^dform_widget_/)) {
			dateChanged = dateChanged.replace('dform_widget_','');
		}
		$("input[type='date'][data-condition~='"+dateChanged+"']").each(function(){
			validateInputData(this,null,true);
		});
	}

	function validateDate(limitdate, date, operator) {
		var diff = Date.parse(date).compareTo(Date.parse(limitdate));
		var valid;
		if (operator == 'min') {
			diff >= 0 ? valid = true : valid = false;
		}
		if (operator == 'max') {
			diff <= 0 ? valid = true : valid = false;
		}
		return valid;
	}

	function validateDateCondition(fielddate, operator, condfielddate, condfielddatetwo) {
		var diff = Date.parse(fielddate).compareTo(Date.parse(condfielddate));
		var valid;
		if (operator == '>') {
			diff > 0 ? valid = true : valid = false;
		}
		if (operator == '<') {
			diff < 0 ? valid = true : valid = false;
		}
		if (operator == '=') {
			diff == 0 ? valid = true : valid = false;
		}
		if(operator == '<=') {
			(diff == 0)||(diff == -1) ? valid = true : valid = false;
		}
		if(operator == '>=') {
			(diff == 0)||(diff == 1) ? valid = true : valid = false;
		}
		if(operator == '><') {
			valid = Date.parse(fielddate).between(Date.parse(condfielddate),Date.parse(condfielddatetwo));
		}
		return valid;
	}

	function clearFieldError(input, custom) {
		var errorClass = 'dform_fielderror';

		if(custom)
			errorClass = 'dform_fielderrorCustom dform_maperrorCustom';

		if ($(input).attr('type') == 'radio' || $(input).attr('type') == 'checkbox') {
			$('input[name="'+$(input).attr('name')+'"]').removeClass(errorClass);
			$(input).parent().siblings('.dform_validationMessage').hide();
		} else {
			$(input).removeClass(errorClass);
		}
		$(input).siblings('.dform_validationMessage').hide();
	}

	function clearWidgetFieldError(input, custom) {
		$(input).parent().parent().removeClass(errorClass);
		$(input).parent().parent().parent().siblings('.dform_validationMessage').hide();
	}

	function showFieldError(input, custom) {
		var errorClass = 'dform_fielderror';

		if(custom)
			errorClass = 'dform_fielderrorCustom';

		if ($(input).attr('type') == 'radio' || $(input).attr('type') == 'checkbox') {
			$('input[name="'+$(input).attr('name')+'"]').addClass(errorClass);
			$(input).parent().siblings('.dform_validationMessage').show();
		} else {
			$(input).addClass(errorClass);
		}
		$(input).siblings('.dform_validationMessage').show();
	}

	function setVal(name,value) {
		if (value instanceof Object) {
			loadWidget(name,value);
		} else {
			loadField(name,value);
			if ($('.dform_widget_'+name).attr('data-type') === 'date') {
				$('[name="_JQDP_'+name+'"]').val(convertDate(value,kdf.dateformat));
			}
		}
	}

	function getVal(name) {
		var container = $('.dform_widget_'+name);
		switch ($(container).attr('data-type')) {
			case 'radio':
				return $('[name="'+name+'"]:checked').val();
				break;
			case 'multicheckbox':
				return $(container).find('input:checked').map(function(){return $(this).val();}).get();
				break;
			case 'html':
				return $(container).html();
				break;
			case 'header':
				return $(container).html();
				break;
			default:
				return $('[name="'+name+'"]').val();
				break;
		}
	}

	//History
	function initHistoryTracking() {
		if (!Modernizr.history)
			return;

		kdf.history = History;

		$(window).bind('statechange', function(){
			hideMessages();

			var state = kdf.history.getState();
			if(state.data.page != kdf.form.currentpage && state.data.page != -1) {
				if (!kdf.sessioncomplete) {
					if(state.data != null && state.data.page != undefined) {

						if($('.dform_page[data-pos="'+state.data.page+'"]').attr('data-active') != 'false') {
							gotoPage(state.data.page, false, false, false);
						} else {
							showWarning(kdf.messages.historyPageNotViewableMsg);
						}

					}

				} else {
					showWarning(kdf.messages.historySessionCompletedMsg);
				}
			}
			if (state.data.page != -1) {
				// -1 funnelback popup
				$('#dform_lock').hide();
				$('.fnlb_popup').html('').hide();
			}
		});
	}


	// Messaging

	function showWarning(message) {
		hideMessages();
		$('#dform_warningMessage').html(localise(message)).fadeIn();
		scrollTop();
	}

	function showInfo(message) {
		hideMessages();
		$('#dform_infoMessage').html(localise(message)).fadeIn();
		scrollTop();
	}

	function showSuccess(message) {
		hideMessages();
		$('#dform_successMessage').html(localise(message)).fadeIn();
		scrollTop();
	}

	function showError(message) {
		hideMessages();
		$('#dform_errorMessage').html(localise(message)).fadeIn();
		scrollTop();
	}

	function scrollTop() {
		window.scrollTo(0,0);
	}

	function hideMessages() {
		$('.dform_message').html('').hide();
	}

	function buildValidationMessage(message) {
		if (kdf && kdf.saveresponse && kdf.saveresponse.validation) {
			message+='<ul>';
			$.each(kdf.saveresponse.validation, function() {
				if (this.message) {
				message += '<li>'+this.pageid+' > '+this.label+' ('+this.message+')<br/></li>';
			} else {
				message += '<li>'+this.pageid+' > '+this.label+'<br/></li>';
			}
			});
			message+='</ul>'
		}
		return message;
	}

	function setLocaleMessages(localemessages) {
		kdf.localemessages = localemessages;
	}

	function localise(message) {
		var locale = kdf.locale;
		var localemessage = message;
		if (kdf.localemessages) {
			$.each( kdf.localemessages, function( key, value ) {
				if (key == message) {
					$.each( value, function( key, value ) {
						if (key == locale) {
							localemessage = value;
							return false;
						}
					});
					return false;
				}
			});
		}
		return localemessage;
	}


	function reset() {
		$('#dform_holder').empty();
		if (kdf) {
			if (kdf.arcgissearchwidgets) {
				var count = kdf.arcgissearchwidgets.length;
				for (var i = 0; i < count; i++) {
					kdf.arcgissearchwidgets[i].destroy();
				}
			}
			kdf.arcgissearchwidgets = [];
			delete kdf.captchaWidgetId;
		}
	}

	// Locking

	function lock() {
		$('#dform_lock, #dform_lockMsg').show();
	}

	function unlock() {
		$('#dform_lock, #dform_lockMsg').hide();
	}



	// Return functions

    return {
		kdf: function() {return kdf},
		init: function(arg) {init(arg)},
		getParams: function() {return getParams()},
		checkSave: function() {checkSave()},
		save: function() {save()},
		setCustomerID: function(id,loaddata,loadpage) {setCustomerID(id,loaddata,loadpage)},
		setOrganisationID: function(id,loaddata,loadpage) {setOrganisationID(id,loaddata,loadpage)},
		setPropertyID: function(id,loaddata,loadpage) {setPropertyID(id,loaddata,loadpage)},
		setStreetID: function(id,loaddata,loadpage) {setStreetID(id,loaddata,loadpage)},
		setInteractionID: function(id) {setInteractionID(id)},
		custom: function(action, actionedby, selector, required, validate, loadform, lockform) {custom(action, actionedby, selector, required, validate, loadform, lockform)},
		customdata: function(action, actionedby, loadform, lockform, data) {customdata(action, actionedby, loadform, lockform, data)},
		ready: function() {ready()},
		home: function() {home()},
		resetControls: function() {resetControls()},
		makeReadonly: function() {makeReadonly()},
		makeWritable: function() {makeWritable()},
		markComplete: function() {markComplete()},
		disableNavToLastPage: function() {disableNavToLastPage()},
		initLogic: function(selector) {initLogic(selector)},
		initButtonLogic: function(selector) {initButtonLogic(selector)},
		initRealtimeValidation: function(selector) {initRealtimeValidation(selector)},
		initOnetomany: function(selector) {initOnetomany(selector)},
		initFileUpload: function(selector) {initFileUpload(selector)},
		initialiseGIS: function(mapHolder) {initialiseGIS(mapHolder)},
		modernize: function(selector) {modernize(selector)},
		loadForm: function(data,preappend,append,holder) {loadForm(data,preappend,append,holder)},
		clone: function(holder,init) {clone(holder,init)},
		hideNav: function() {hideNav()},
		showNav: function() {showNav()},
		hideControls: function() {hideControls()},
		showControls: function() {showControls()},
		gotoNextPage: function() {gotoNextPage()},
		gotoPrevPage: function() {gotoPrevPage()},
		gotoPage: function(gotoid,check,clearmessages,pushhistory) {gotoPage(gotoid,check,clearmessages,pushhistory)},
		showPage: function(page) {showPage(page)},
		hidePage: function(page) {hidePage(page)},
		showSection: function(section) {showSection(section)},
		hideSection: function(section) {hideSection(section)},
		showWidget: function(widget) {showWidget(widget)},
		hideWidget: function(widget) {hideWidget(widget)},
		setWidgetRequired: function(widget) {setWidgetRequired(widget)},
		setWidgetNotRequired: function(widget) {setWidgetNotRequired(widget)},
		calculateActiveFields: function() {calculateActiveFields()},
		checkProgress: function() {return checkProgress()},
		check: function(selector) {return check(selector)},
		validateInput: function(element) {return validateInput(element)},
		validateInputRequired: function(element) {return validateInputRequired(element)},
		validateInputData: function(element,custom) {return validateInputData(element,custom)},
		checkGIS: function(element,custom) {return checkGIS(element,custom)},
		checkSearchWidget: function(element) {return checkSearchWidget(element)},
		clearFieldError: function(input,custom) {clearFieldError(input,custom)},
		clearWidgetFieldError: function(input,custom) {clearWidgetFieldError(input,custom)},
		showFieldError: function(input,custom) {showFieldError(input,custom)},
		lock: function() {lock()},
		unlock: function() {unlock()},
		showWarning: function(message) {showWarning(message);},
		showInfo: function(message) {showInfo(message);},
		showSuccess: function(message) {showSuccess(message);},
		showError: function(message) {showError(message);},
		hideMessages: function() {hideMessages();},
		buildValidationMessage: function (message) {return buildValidationMessage(message)},
		setLocaleMessages: function(localemessages) {setLocaleMessages(localemessages)},
		localise: function (message) {return localise(message)},
		getVal: function (name) {return getVal(name)},
		setVal: function (name,value) {setVal(name,value)},
		validateField: function(name) {validateField(name)},
		setDefaultDates: function() {return setDefaultDates()},
		reset: function() {reset()}
    };

}(this, this.document, this.jQuery));
