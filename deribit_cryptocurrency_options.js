registerEA(
"cryptocurrency_option_trading_platform",
"A plugin to trade cryptocurrency options(v0.01)",
[{
	name: "instrument",
	value: "ticker.BTC-18OCT20-11000-C.raw",
	required: false,
	type: "String",
	range: null,
	step: null
}],
function (context) { // Init()
      var orderBookId = null

      function convertOptionName (rawName) {
        var name = rawName.split("-")
        var year = name[1].substring(5, 7)
        var mon = name[1].substring(2, 5)
        var dt = name[1].substring(0, 2)
        var month = "00"
        if (mon == "JAN") {
          month = "01"
        } else if (mon == "FEB") {
          month = "02"
        } else if (mon == "MAR") {
          month = "03"
        } else if (mon == "APR") {
          month = "04"
        } else if (mon == "MAY") {
          month = "05"
        } else if (mon == "JUN") {
          month = "06"
        } else if (mon == "JUL") {
          month = "07"
        } else if (mon == "AUG") {
          month = "08"
        } else if (mon == "SEP") {
          month = "09"
        } else if (mon == "OCT") {
          month = "10"
        } else if (mon == "NOV") {
          month = "11"
        } else if (mon == "DEC") {
          month = "12"
        }
        var expiration = parseInt(year + month + dt)
        var optionName2 = name[0] + "-" + dt + mon + year

        return {
          optionName: name[0] + "-" + expiration,
          optionName2: optionName2,
          instrument: name[0],
          expiration: expiration,
          year: year,
          month: month,
          dt: dt,
          strikePrice: parseFloat(name[2]),
          callOrPut: name[3]
        }
      }

      function parseOrderBook (data) {
        var orderBookData = []

        for (var i in data) {
          var optionName = convertOptionName(data[i].instrument_name)

          if (typeof orderBookData[optionName.optionName] == "undefined") {
            orderBookData[optionName.optionName] = {
              optionName: optionName.optionName,
              optionName2: optionName.optionName2,
              instrument: optionName.instrument,
              expiration: optionName.expiration,
              year: optionName.year,
              month: optionName.month,
              dt: optionName.dt,
              prices: [],
              arrPrices: []
            }
          }

          if (typeof orderBookData[optionName.optionName].prices[optionName.strikePrice] == "undefined") {
            orderBookData[optionName.optionName].prices[optionName.strikePrice] = {
              strikePrice: optionName.strikePrice,
              bidC: optionName.callOrPut == "C" ? data[i].bid_price : null,
              askC: optionName.callOrPut == "C" ? data[i].ask_price : null,
              bidP: optionName.callOrPut == "P" ? data[i].bid_price : null,
              askP: optionName.callOrPut == "P" ? data[i].ask_price : null
            }
          } else {
            var price = orderBookData[optionName.optionName].prices[optionName.strikePrice]
            if (price.bidC == null) {
              price.bidC = optionName.callOrPut == "C" ? data[i].bid_price : null
            }
            if (price.askC == null) {
              price.askC = optionName.callOrPut == "C" ? data[i].ask_price : null
            }
            if (price.bidP == null) {
              price.bidP = optionName.callOrPut == "P" ? data[i].bid_price : null
            }
            if (price.askP == null) {
              price.askP = optionName.callOrPut == "P" ? data[i].ask_price : null
            }
          }
        }

        for (var i in orderBookData) {
          for (var j in orderBookData[i].prices) {
            orderBookData[i].arrPrices.push(orderBookData[i].prices[j])
          }
        }

        var expirations = []

        for (var i in orderBookData) {
          expirations.push({
            expiration: orderBookData[i].expiration,
            optionName: orderBookData[i].optionName,
            optionName2: orderBookData[i].optionName2
          })
        }

        expirations.sort(function (a, b) {return a.expiration - b.expiration})

        return {
          expirations: expirations,
          orderBookData: orderBookData
        }
      }

      function showOptions (expirations) {
        var optionsHtml = ""

        for (var i in expirations) {
          optionsHtml += '<div class="item" data-value="' + expirations[i].optionName + '">' + expirations[i].optionName2 + '</div>'
        }

        $("#crypto_options").empty()
        $("#crypto_options").html(optionsHtml)
        $("#crypto_options_dashboard").find(".ui.dropdown").dropdown({
          onChange: function (val) {
            showOrderBook(val, window.orderBookData.orderBookData)
          }
        })
      }

      function showOrderBook (optionName, orderBookData) {
        if ($.fn.dataTable.isDataTable("#options")) {
    			$("#options").DataTable().clear().draw()

          for (var i in orderBookData) {
            if (orderBookData[i].optionName == optionName) {
              for (var j in orderBookData[i].arrPrices) {
                $("#options").DataTable().row.add([
                  orderBookData[i].arrPrices[j].bidC,
                  orderBookData[i].arrPrices[j].askC,
                  orderBookData[i].arrPrices[j].strikePrice,
                  orderBookData[i].arrPrices[j].bidP,
                  orderBookData[i].arrPrices[j].askP
                ]).draw(false)
              }
            }
          }
        }
      }

      function initCryptoOptionsWS () {
        window.wsock = new WebSocket("wss://test.deribit.com/ws/api/v2")
        window.wsockOpened = false

        window.wsock.onmessage = function (e) {
          var resData = JSON.parse(e.data)
          if (orderBookId != null && orderBookId == resData.id) {
            window.orderBookData = parseOrderBook(resData.result)
            showOptions(window.orderBookData.expirations)
            showOrderBook(window.orderBookData.expirations[0].optionName, window.orderBookData.orderBookData)
          }
        }

        window.wsock.onopen = function () {
          window.wsockOpened = true
        }
      }

      function disconnectCryptoOptionsWS () {
        if (typeof window.wsockOpened != "undefined" && window.wsockOpened) {
          if (typeof window.wsockSubscribed != "undefined" && window.wsockSubscribed) {
            var msg = {
              jsonrpc: "2.0",
              id: new Date().getTime(),
              method: "public/unsubscribe",
              params: {
                channels: [
                  instrument // "deribit_price_index.btc_usd"
                ]
              }
            }

            window.wsock.send(JSON.stringify(msg))
            delete window.wsockSubscribed
          }

          window.wsock.close()
          delete window.wsock
          delete window.wsockOpened
        }
      }

      function getOrderBook (currency) {
        if (typeof window.wsockOpened != "undefined" && window.wsockOpened) {
          orderBookId = new Date().getTime()

          var msg = {
            jsonrpc: "2.0",
            id: orderBookId,
            method: "public/get_book_summary_by_currency",
            params: {
              currency: currency,
              kind: "option"
            }
          }

          window.wsock.send(JSON.stringify(msg))
        }
      }

      function subscribeIt () {
        if (typeof window.wsockOpened != "undefined" && window.wsockOpened) {
          if (typeof window.wsockSubscribed == "undefined" || !window.wsockSubscribed) {
            var msg = {
              jsonrpc: "2.0",
              id: new Date().getTime(),
              method: "public/subscribe",
              params: {
                channels: [
                  instrument // "deribit_price_index.btc_usd"
                ]
              }
            }

            window.wsock.send(JSON.stringify(msg))
            window.wsockSubscribed = true
          }
        }
      }

      function unsubscribeIt () {
        if (typeof window.wsockOpened != "undefined" && window.wsockOpened) {
          if (typeof window.wsockSubscribed != "undefined" && window.wsockSubscribed) {
            var msg = {
              jsonrpc: "2.0",
              id: new Date().getTime(),
              method: "public/unsubscribe",
              params: {
                channels: [
                  instrument // "deribit_price_index.btc_usd"
                ]
              }
            }

            window.wsock.send(JSON.stringify(msg))
            window.wsockSubscribed = false
          }
        }
      }

      var panel = '<div class="ui modal" id="crypto_options_dashboard">' +
        '<i class="close icon"></i>' +
        '<div class="content">' +
          '<div id="loading_crypto_options">' +
            '<div class="ui text">Loading............</div>' +
          '</div>' +
          '<div class="ui selection dropdown" style="width:200px">' +
            '<input type="hidden" name="gender">' +
            '<i class="dropdown icon"></i>' +
            '<div class="default text">Options</div>' +
            '<div class="menu" id="crypto_options">' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="content">' +
          '<div class="description">' +
            '<table id="options" class="cell-border" cellspacing="0">' +
      			'</table>' +
          '</div>' +
        '</div>' +
        '<div class="actions">' +
          // '<div class="ui button" id="subscribe_it">Subscribe</div>' +
          // '<div class="ui button" id="unsubscribe_it">Unsubscribe</div>' +
          '<div class="ui button" id="disconnect_ws">Disconnect</div>' +
        '</div>' +
      '</div>'

      $("#crypto_options_dashboard").remove()
      $("#reserved_zone").html(panel)
      $("#loading_crypto_options").show()

      if (!$.fn.dataTable.isDataTable("#options")) {
  			$("#options").DataTable({
  				data: [],
  				columns: [
  					{title: "Bid(C)"},
  					{title: "Ask(C)"},
            {title: "Strike Price"},
  					{title: "Bid(P)"},
  					{title: "Ask(P)"}
  				],
          ordering: false,
          searching: false,
          bPaginate: false,
          bLengthChange: false,
          bFilter: false,
          bInfo: false,
          scrollY: '50vh',
          scrollCollapse: true,
          paging: false,
          columnDefs: [
            {width: "20%", targets: 0, className: "dt-body-right"},
            {width: "20%", targets: 1, className: "dt-body-right"},
            {width: "20%", targets: 2, className: "dt-body-center"},
            {width: "20%", targets: 3, className: "dt-body-right"},
            {width: "20%", targets: 4, className: "dt-body-right"},
            {width: "20%", targets: [0, 1, 2, 3, 4], className: "dt-head-center"}
          ]
  			})
  		}

      // $("#subscribe_it").on("click", function () {
      //   subscribeIt()
      // })
      // $("#unsubscribe_it").on("click", function () {
      //   unsubscribeIt()
      // })
      $("#disconnect_ws").on("click", function () {
        disconnectCryptoOptionsWS()
      })

      var instrument = getEAParameter(context, "instrument")

      initCryptoOptionsWS()

      $("#crypto_options_dashboard").modal("show")

      setTimeout(function () {
        getOrderBook("BTC")
        $("#loading_crypto_options").hide()
      }, 10000)
		},
function (context) { // Deinit()
		},
function (context) { // OnTick()
		})
