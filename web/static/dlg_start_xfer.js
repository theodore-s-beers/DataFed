import * as model from "./model.js";
import * as util from "./util.js";
import * as settings from "./settings.js";
import * as api from "./api.js";
import * as dialogs from "./dialogs.js";
import * as dlgEpBrowse from "./dlg_ep_browse.js";

export function show(a_mode, a_ids, a_cb) {
    var frame = $(document.createElement('div'));
    var ep_lab = a_mode == model.TT_DATA_GET ? "Destination" : "Source";
    var rec_lab = a_mode == model.TT_DATA_GET ? "Source" : "Destination";
    var rec_tree;

    frame.html("<div class='ui-widget' style='height:95%'>" +
        rec_lab + ": <span id='title'></span><br>" +
        "<div class='col-flex' style='height:100%'>" +
        "<div id='records' class='ui-widget ui-widget-content' style='flex: 1 1 auto;display:none;height:6em;overflow:auto'></div>" +
        "<div style='flex:none'><br>" +
        "<span>" + ep_lab + " Path:</span>" +
        "<div style='display: flex; align-items: flex-start;'>" +
        "<textarea class='ui-widget-content' id='path' rows=3 style='width:100%;resize:none;'></textarea>" +
        "<button class='btn small' id='browse' style='margin-left:10px; line-height:1.5; vertical-align: top;' disabled>Browse</button></div>" +
        "<br><select class='ui-widget-content ui-widget' id='matches' size='7' style='width: 100%;' disabled><option disabled selected>No Matches</option></select><br>" +
        //"<button class='btn small' id='refresh'>Refresh</button>&nbsp<button class='btn small' id='activate' disabled>(re)Activate</button>&nbsp<button class='btn small' id='browse' style='margin:0' disabled>Browse</button></div>" +
        "<br>Transfer Encryption:&nbsp" +
        "<input type='radio' id='encrypt_none' name='encrypt_mode' value='0'>" +
        "<label for='encrypt_none'>None</label>&nbsp" +
        "<input type='radio' id='encrypt_avail' name='encrypt_mode' value='1' checked/>" +
        "<label for='encrypt_avail'>If Available</label>&nbsp" +
        "<input type='radio' id='encrypt_req' name='encrypt_mode' value='2'/>" +
        "<label for='encrypt_req'>Required</label><br>" +
        (a_mode == model.TT_DATA_PUT ? "<br>File extension override: <input id='ext' type='text'></input><br>" : "") +
        (a_mode == model.TT_DATA_GET ? "<br><label for='orig_fname'>Download to original filename(s)</label><input id='orig_fname' type='checkbox'></input>" : "") +
        "</div></div></div>");

    var dlg_title = (a_mode == model.TT_DATA_GET ? "Download Raw Data" : "Upload Raw Data");
    var selection_ok = true, endpoint_ok = false, matches = $("#matches", frame);
    var path_in = $("#path", frame), ep_list = null, cur_ep = null, item;

    function updateGoBtn() {
        if (selection_ok && endpoint_ok)
            $("#go_btn").button("enable");
        else
            $("#go_btn").button("disable");
    }

    if (!a_ids) {
        $("#title", frame).html("(new record)");
    } else if (a_ids.length > 1) {
        var skip = 0, tot_sz = 0, info, sel, src = [];

        for (var i in a_ids) {
            item = a_ids[i];
            if (item.size == 0) {
                info = "(empty)";
                sel = false;
            } else if (item.locked) {
                info = "(locked)";
                sel = false;
            } else {
                tot_sz += parseInt(item.size);
                info = util.sizeToString(item.size);
                sel = true;
            }

            if (sel) {
                src.push({ title: item.id + "&nbsp&nbsp&nbsp<span style='display:inline-block;width:9ch'>" + info + "</span>&nbsp" + item.title, selected: true, key: item.id });
            } else {
                skip += 1;
                src.push({ title: "<span style='color:#808080'>" + item.id + "&nbsp&nbsp&nbsp<span style='display:inline-block;width:9ch'>" + info + "</span>&nbsp" + item.title + "</span>", unselectable: true, key: item.id });
            }
        }
        $("#title", frame).text("" + a_ids.length + " records, " + skip + " skipped, total size: " + util.sizeToString(tot_sz));

        $($("#records", frame), frame).fancytree({
            extensions: ["themeroller"],
            themeroller: {
                activeClass: "my-fancytree-active",
                hoverClass: ""
            },
            source: src,
            nodata: false,
            checkbox: true,
            selectMode: 3,
            icon: false,
            select: function (ev, data) {
                var sel = rec_tree.getSelectedNodes();
                if (sel.length) {
                    if (!selection_ok) {
                        selection_ok = true;
                        updateGoBtn();
                    }
                } else {
                    if (selection_ok) {
                        selection_ok = false;
                        updateGoBtn();
                    }
                }
            }
        });

        $("#records", frame).show();
        rec_tree = $.ui.fancytree.getTree($("#records", frame));
    } else {
        item = a_ids[0];
        console.log("item:", item);

        var html = item.id + "&nbsp&nbsp" + util.sizeToString(item.size) + "&nbsp&nbsp" + util.escapeHTML(item.title);
        $("#title", frame).html(html);
        if (a_mode == model.TT_DATA_PUT && item.source) {
            console.log("source:", item.source);
            path_in.val(item.source);
        }
    }

    util.inputTheme(path_in);
    util.inputTheme($("#ext", frame));
    
/**
* Handles changes on the 'matches' select element.
* When a selection is made, it retrieves the selected endpoint's ID from 'ep_list',
* fetches detailed endpoint info via 'api.epView', and updates the UI accordingly.
*
* Expected Behavior:
* User selects an option in 'matches'.
* Retrieves the corresponding endpoint ID from 'ep_list'.
* Calls 'api.epView' with the endpoint ID.
* On success, updates 'cur_ep' and 'path_in' input field, then refreshes the UI with 'updateEndpointOptions'.
* On failure, displays an error dialog.
* When a new endpoint is selected in the 'matches' dropdown, the 'path_in' input field will be updated
* with the selected endpoint's name and default directory, and the UI will be refreshed with the new options.
*/
    matches.on('change', function (ev) {
        if (ep_list) {
            var ep = ep_list[$(this).prop('selectedIndex') - 1].id;
            api.epView(ep, function (ok, data) {
                if (ok && !data.code) {
                    cur_ep = data;
                    cur_ep.name = cur_ep.canonical_name || cur_ep.id;
                    path_in.val( cur_ep.name + (cur_ep.default_directory?cur_ep.default_directory:"/"));
                    path_in.val(path_in.val().replace("{server_default}/",''))
                    updateEndpointOptions( cur_ep );
                }else{
                    dialogs.dlgAlert("Globus Error", data );
                }
            });
        }
    });

    $(".btn", frame).button();

    $("#refresh", frame).on('click', function () {
        clearTimeout(in_timer);
        $("#browse", frame).button("disable");
        $("#activate", frame).button("disable");
        cur_ep = null;
        in_timer = setTimeout(inTimerExpired, 250);
    });

    $("#browse", frame).on('click', function () {
        var path = path_in.val();
        var delim = path.indexOf("/");
        if (delim != -1) {
            path = path.substr(delim);
            if (path.charAt(path.length - 1) != "/") {
                delim = path.lastIndexOf("/");
                if (delim > 0)
                    path = path.substr(0, delim + 1);
                else
                    path += "/";
            }
        } else
            path = cur_ep.default_directory ? cur_ep.default_directory : "/";
        dlgEpBrowse.show(cur_ep, path, (a_mode == model.TT_DATA_GET) ? "dir" : "file", function (sel) {
            path_in.val(cur_ep.name + sel);
        });
    });

    $("#activate", frame).on('click', function () {
        window.open('https://app.globus.org/file-manager?origin_id=' + encodeURIComponent(cur_ep.id), '');
    });

    if (a_mode == model.TT_DATA_GET)
        $("#orig_fname", frame).checkboxradio();

    function updateEndpointOptions(cur_ep) {
        if (cur_ep.activated || cur_ep.expires_in == -1) {
            $("#browse", frame).button("enable");
            endpoint_ok = true;
            updateGoBtn();
        } else {
            $("#browse", frame).button("disable");
            endpoint_ok = false;
            updateGoBtn();
        }

        if (cur_ep.expires_in == -1)
            $("#activate", frame).button("disable");
        else
            $("#activate", frame).button("enable");

        if (cur_ep.force_encryption) {
            $("#encrypt_none").checkboxradio("option", "disabled", true);
            $("#encrypt_avail").checkboxradio("option", "disabled", true);
            $("#encrypt_req").prop('checked', true).checkboxradio("option", "disabled", false);
        } else if (!cur_ep.DATA[0].scheme || cur_ep.DATA[0].scheme == "gsiftp") {
            $("#encrypt_none").checkboxradio("option", "disabled", false);
            $("#encrypt_avail").checkboxradio("option", "disabled", false);
            $("#encrypt_req").checkboxradio("option", "disabled", false);
        } else {
            $("#encrypt_none").prop('checked', true).checkboxradio("option", "disabled", false);
            $("#encrypt_avail").checkboxradio("option", "disabled", true);
            $("#encrypt_req").checkboxradio("option", "disabled", true);
        }

        $(":radio").button("refresh");
    }

/**
* Handles the expiration of the input timer.
* Retrieves the endpoint from 'path_in', validates it, and updates the endpoint options in the UI.
*
* Expected Behavior:
* Trims and validates the input from 'path_in'.
* If empty, clears 'ep_list' and disables 'matches'.
* Retrieves the base endpoint if it contains a delimiter.
* If the endpoint has changed, disables certain buttons and fetches endpoint details via 'api.epView'.
* On success, updates 'cur_ep', populates 'matches', and enables it.
* On failure, calls 'api.epAutocomplete' to fetch and display matching endpoints.
*/

    var in_timer;
    let searchCounter = 0;
    let currentSearchToken = null;
    function inTimerExpired(searchToken) {
        // If this is not the latest search, ignore the result
        if (searchToken !== currentSearchToken) return;

        var ep = path_in.val().trim();

        if (ep.length == 0) {
            ep_list = null;
            matches.html("<option disabled selected>No Matches</option>");
            matches.prop("disabled", true);
            return;
        }

        var delim = ep.indexOf("/");
        if (delim != -1) ep = ep.substr(0, delim);

        if (!cur_ep || ep != cur_ep.name) {
            $("#browse", frame).button("disable");
            $("#activate", frame).button("disable");

            // Wrap api.epView in a promise
            new Promise((resolve, reject) => {
                if (searchToken !== currentSearchToken) reject();
                api.epView(ep, function (ok, data) {
                    if (ok && !data.code) {
                        resolve(data);
                    } else {
                        reject(data);
                    }
                });
            }).then(data => {
                cur_ep = data;
                cur_ep.name = cur_ep.canonical_name || cur_ep.id;
                updateEndpointOptions(cur_ep);

                var html = "<option title='" + (cur_ep.description ? util.escapeHTML(cur_ep.description) : "(no info)") + "'>" + util.escapeHTML(cur_ep.display_name || cur_ep.name) + " (";

                if (cur_ep.activated)
                    html += Math.floor(cur_ep.expires_in / 3600) + " hrs";
                else if (cur_ep.expires_in == -1)
                    html += "active";
                else
                    html += "inactive";

                html += ")</option>";

                matches.html(html);
                matches.prop("disabled", false);
            }).catch(() => {
                cur_ep = null;

                // Wrap api.epAutocomplete in a promise
                new Promise((resolve, reject) => {
                    api.epAutocomplete(ep, function (ok, data) {
                        if (searchToken !== currentSearchToken) return;
                        if (ok) {
                            resolve(data);
                        } else {
                            reject(data);
                        }
                    });
                }).then(data => {
                    if (data.DATA && data.DATA.length) {
                        ep_list = data.DATA;
                        var ep;
                        var html = "<option disabled selected>" + data.DATA.length + " match" + (data.DATA.length > 1 ? "es" : "") + "</option>";
                        for (var i in data.DATA) {
                            ep = data.DATA[i];
                            ep.name = ep.canonical_name || ep.id;
                            html += "<option title='" + util.escapeHTML(ep.description) + "'>" + util.escapeHTML(ep.display_name || ep.name) + " (";
                            if (!ep.activated && ep.expires_in == -1)
                                html += "active)</option>";
                            else
                                html += (ep.activated ? Math.floor(ep.expires_in / 3600) + " hrs" : "inactive") + ")</option>";
                        }
                        matches.html(html);
                        matches.prop("disabled", false);
                    } else {
                        ep_list = null;
                        matches.html("<option disabled selected>No Matches</option>");
                        matches.prop("disabled", true);

                        if (data.code) {
                            dialogs.dlgAlert("Globus Error", data.code);
                        }
                    }
                }).catch(data => {
                    dialogs.dlgAlert("Globus Error", data);
                });
            });
        }
    }


    var options = {
        title: dlg_title,
        modal: true,
        width: '600',
        height: 'auto',
        resizable: true,
        buttons: [{
            text: "Cancel",
            click: function () {
                clearTimeout(in_timer);
                $(this).dialog('close');
            }
        }, {
            id: "go_btn",
            text: (a_mode != null ? "Start" : "Select"),
            click: function () {
                var raw_path = $("#path", frame).val().trim();
                if (!raw_path) {
                    dialogs.dlgAlert("Input Error", "Path cannot be empty.");
                    return;
                }

                var encrypt = $("input[name='encrypt_mode']:checked").val(),
                    orig_fname = $("#orig_fname", frame).prop("checked"),
                    inst = $(this);

                if (a_mode == model.TT_DATA_GET || a_mode == model.TT_DATA_PUT) {
                    var ext = $("#ext", frame).val();
                    if (ext)
                        ext.trim();

                    var ids = [];
                    if (a_ids.length == 1)
                        ids = [a_ids[0].id];
                    else {
                        var sel = rec_tree.getSelectedNodes();
                        for (var i in sel) {
                            ids.push(sel[i].key);
                        }
                    }

                    api.xfrStart(ids, a_mode, raw_path, ext, encrypt, orig_fname, function (ok, data) {
                        if (ok) {
                            clearTimeout(in_timer);
                            inst.dialog('close');
                            util.setStatusText("Task '" + data.task.id + "' created for data transfer.");
                            if (a_cb) {
                                a_cb();
                            }
                        } else {
                            dialogs.dlgAlert("Transfer Error", data);
                        }
                    });
                } else {
                    a_cb(raw_path, encrypt);
                    clearTimeout(in_timer);
                    $(this).dialog('close');
                }
            }
        }],
        open: function () {
            updateGoBtn();

            $(":radio").checkboxradio();

            if (path_in.val().length == 0) {
                if (settings.ep_recent.length) {
                    path_in.val(settings.ep_recent[0]);
                    path_in.select();
                    path_in.autocomplete({
                        source: settings.ep_recent,
                        select: function () {
                            currentSearchToken = ++searchCounter;
                            inTimerExpired(currentSearchToken);
                        }
                    });
                    currentSearchToken = ++searchCounter;
                    inTimerExpired(currentSearchToken);
                }
            } else {
                currentSearchToken = ++searchCounter;
                inTimerExpired(currentSearchToken);
            }

            let lastValue = path_in.val();

            path_in.on('input', function () {
                let currentValue = path_in.val();

                if (cur_ep && !currentValue.startsWith(cur_ep.name)) {
                    endpoint_ok = false;
                    updateGoBtn();
                }

                if (lastValue !== currentValue) {
                    lastValue = currentValue;
                    currentSearchToken = ++searchCounter;
                    inTimerExpired(currentSearchToken);
                }
            });
        },
        close: function (ev, ui) {
            $(this).dialog("destroy").remove();
        }

    };

    frame.dialog(options);
}

