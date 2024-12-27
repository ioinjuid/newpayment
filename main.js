let tcartCopy;

function updateTcartCopy() {
    tcartCopy = JSON.parse(JSON.stringify(window.tcart));
}

/**
 * @param shopId {string|number} ID магазина
 * @param options {{ lang: string, currency: string, nameInputName: string, phoneInputName: string,
 * emailInputName: string, srDeliveryName: string, ignoreVendorCodes: string[], addOptionsToName: string }|undefined}
 * @param options.lang Язык виджета
 * @param options.currency Валюта ('rub', 'usd', 'euro')
 * @param options.nameInputName Поле "Имя"
 * @param options.phoneInputName Поле "Телефон"
 * @param options.emailInputName Поле "E-mail"
 * @param options.deliveryCompanyInputName Поле для названия компании доставки
 * @param options.deliveryAddressInputName Поле для адреса доставки
 * @param options.deliveryTypeInputName Поле для типа доставки
 * @param options.commentInputName Поле для комментария для курьера
 * @param options.srDeliveryName Фрагмент названия варианта доставки SafeRoute в чекауте
 * @param options.ignoreVendorCodes Массив артикулов товаров, которые не будут учитываться виджетом
 * @param options.addOptionsToName Добавлять к названиям товаров пар��метры этих товаров
 */
window.srCartWidgetInit = (shopId, options = {}) => {
    if (!shopId)
        return alert("SafeRoute Widget Error: Не передан параметр shopId");

    setTimeout(() => {
        if (typeof tcart__openCart === "undefined") return;

        $("head")
            .append(
                '<link rel="stylesheet" href="https://api.saferoute.ru/front/tilda/styles.css" type="text/css" />'
            )
            .append(
                '<script src="https://widgets.saferoute.ru/cart/api.js"></script>'
            );

        $(".t-radio__wrapper-delivery")
            .closest(".t-input-group")
            .after(
                '<div id="saferoute-widget"></div><div id="saferoute-delivery-info"></div>'
            );

        // Способ оплаты с НП
        const CODPaymentID = "cash";

        let widget;
        let widgetData;

        const $orderForm = $(".t706__orderform form");
        const phoneInputSelector =
            ".t706__orderform input[name=" +
            (options.phoneInputName || "Phone") +
            "]";
        const $nameInput = $orderForm.find(
            "input[name=" + (options.nameInputName || "Name") + "]"
        );
        const $emailInput = $orderForm.find(
            "input[name=" + (options.emailInputName || "Email") + "]"
        );
        const $deliveryCompanyInput = $orderForm.find(
            "input[name=" + options.deliveryCompanyInputName + "]"
        );
        const $deliveryAddressInput = $orderForm.find(
            "input[name=" + options.deliveryAddressInputName + "]"
        );
        const $deliveryTypeInput = $orderForm.find(
            "input[name=" + options.deliveryTypeInputName + "]"
        );
        const $commentInput = $orderForm.find(
            "input[name=" + options.commentInputName + "]"
        );
        const $srIdlInput = $orderForm.find("input[name=SRID]");
        const $srOrderDataInput = $orderForm.find(
            "input[name=saferoute-order-data]"
        );
        const $deliverySelectRadio = $orderForm.find(
            ".t-radio__wrapper-delivery input:radio"
        );
        const $formSubmitBtn = $orderForm.find(".t-form__submit button");
        const $srDeliveryInfo = $orderForm.find("#saferoute-delivery-info");

        $srDeliveryInfo.css("font-family", $(".t-descr").css("font-family"));

        const cookie = {
            set(name, value) {
                const date = new Date();
                date.setTime(date.getTime() + 3 * 24 * 60 * 60 * 1000);

                document.cookie =
                    name +
                    "=" +
                    (value || "") +
                    "; expires=" +
                    date.toUTCString() +
                    "; path=/";
            },
            remove(name) {
                document.cookie =
                    name + "=;expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/";
            },
        };

        function SRIsSelected() {
            const val = $deliverySelectRadio.filter(":checked").val();

            return options.srDeliveryName
                ? val
                      .toLowerCase()
                      .includes(options.srDeliveryName.toLowerCase())
                : /saferoute/i.test(val);
        }

        function clearSRSelectedDelivery() {
            cookie.remove("SafeRouteOrderID");
            $srDeliveryInfo.empty();
            $srOrderDataInput.val("");
            $formSubmitBtn.prop("disabled", false);
            toggleCODPayment(true);
        }

        function selectedPaymentWithCOD() {
            return (
                $("input[name=paymentsystem]:checked").val() === CODPaymentID
            );
        }

        function getTotalPrice() {
            if (!widgetData || !widgetData.delivery) return 0;

            let totalPrice =
                widgetData.delivery.totalPrice +
                (widgetData.payTypeCommission || 0);
            if (selectedPaymentWithCOD())
                totalPrice += widgetData.delivery.priceCommissionCod;

            return totalPrice;
        }

        function setDeliveryPrice(price) {
            $deliverySelectRadio
                .filter(":checked")
                .attr("data-delivery-price", price)
                .trigger("change", [true]);

            tcart__updateDelivery();
        }

        function toggleCODPayment(show) {
            const $control = $("input[name=paymentsystem][value=cash]").closest(
                ".t-radio__control"
            );

            if (show) {
                $control.show();
            } else {
                $control.hide();
                $("input[name=paymentsystem]:visible").trigger("click");

                if (SRIsSelected()) setDeliveryPrice(getTotalPrice());
            }
        }

        // Скрыть/показать поля ФИО, E-mail и телефона в корзине
        function toggleFields(show) {
            if (show) {
                $nameInput
                    .closest(".t-input-group")
                    .removeClass("hide-for-saferoute");
                $emailInput
                    .closest(".t-input-group")
                    .removeClass("hide-for-saferoute");
                $(phoneInputSelector)
                    .closest(".t-input-group")
                    .removeClass("hide-for-saferoute");
            } else {
                $nameInput
                    .closest(".t-input-group")
                    .addClass("hide-for-saferoute");

                if ($emailInput.data("tilda-req") !== 1)
                    // Скрыть E-mail только если поле не обязательное
                    $emailInput
                        .closest(".t-input-group")
                        .addClass("hide-for-saferoute");

                if (
                    !$(phoneInputSelector).closest(".t-input-phonemask__wrap")
                        .length
                )
                    $(phoneInputSelector)
                        .closest(".t-input-group")
                        .addClass("hide-for-saferoute");
            }
        }

        function runSRCartWidget() {
            if (widget) widget.destruct();
            clearSRSelectedDelivery();
            toggleFields(false);

            let weight = null;
            const products = tcartCopy.products
                .map((item) => {
                    if (item.deleted) return null;

                    // Подсчет общего веса
                    const itemWeight = parseFloat(item.pack_m);
                    if (itemWeight) {
                        if (!weight) weight = 0;
                        weight += (itemWeight / 1000) * item.quantity;
                    }

                    let name = item.name.trim();
                    let vendorCode = item.sku;

                    const vendorCodeReg = /\[{2}[^\]]+]{2}$/;

                    if (!vendorCode && vendorCodeReg.test(name)) {
                        vendorCode = name.substring(
                            name.lastIndexOf("[[") + 2,
                            name.lastIndexOf("]]")
                        );
                        name = name.replace(vendorCodeReg, "").trim();
                    }

                    // Пропуск товаров, артикулы которых переданы в опции 'ignoreVendorCodes'
                    if (
                        options.ignoreVendorCodes &&
                        options.ignoreVendorCodes.includes(vendorCode)
                    )
                        return null;

                    // Добавление параметров товара к его названию при наличии опции 'addOptionsToName'
                    if (options.addOptionsToName && item.options) {
                        const options = item.options.map(
                            ({ option, variant }) => `${option}: ${variant}`
                        );

                        name += ` (${options.join("; ")})`;
                    }

                    return {
                        name,
                        price: item.price,
                        count: item.quantity,
                        width: Number(item.pack_x) ? item.pack_x / 10 : null,
                        height: Number(item.pack_y) ? item.pack_y / 10 : null,
                        length: Number(item.pack_z) ? item.pack_z / 10 : null,
                        vendorCode,
                    };
                })
                .filter((item) => item);

            if (!products.length) {
                toggleFields(true);
                return;
            }

            // Сброс стоимости доставки SafeRoute
            setDeliveryPrice(0);
            // Блокировка кнопки отправки формы, пока не будет выбран способ доставки
            setTimeout(() => $formSubmitBtn.prop("disabled", true), 50);

            // Определение языка (переданного при инициализации или из домена, или из пути)
            const allowedLangs = ["ru", "en"];
            let lang = "ru";
            if (allowedLangs.includes(options.lang)) {
                lang = options.lang;
            } else if (allowedLangs.includes(location.hostname.split(".")[0])) {
                lang = location.hostname.split(".")[0];
            } else if (allowedLangs.includes(location.pathname.split("/")[1])) {
                lang = location.pathname.split("/")[1];
            }

            // Определение валюты
            const allowedCurrencies = { $: "usd", "в‚¬": "euro" };
            let currency;
            if (options.currency) {
                currency = options.currency;
            } else if (allowedCurrencies[tcartCopy.currency]) {
                currency = allowedCurrencies[tcartCopy.currency];
            }

            const texts = (() => {
                switch (lang) {
                    case "ru":
                        return {
                            changeDelivery:
                                "Изменить способ доставки",
                            selectedDelivery:
                                "Выбранный способ доставки:",
                        };
                    case "en":
                        return {
                            changeDelivery: "Change delivery",
                            selectedDelivery: "Selected delivery:",
                        };
                }
            })();

            widget = new SafeRouteCartWidget("saferoute-widget", {
                mod: "tilda",
                apiScript: `https://api.saferoute.ru/tilda/api-script?shop_id=${shopId}`,
                weight,
                currency,
                lang,
                products,
                discount:
                    (tcartCopy.prodamount_discountsum || 0) +
                    (tcartCopy.dyndiscount || 0),
                userFullName: $.trim($nameInput.val()),
                userPhone: $.trim($(phoneInputSelector).val()).replace(
                    /\D/g,
                    ""
                ),
                userEmail: $.trim($emailInput.val()),
            });

            widget.on("change", (data) => {
                widgetData = data;
            });

            widget.on("done", (response) => {
                widget.destruct();
                widget = null;

                $nameInput.val(widgetData.contacts.fullName);
                // Если у поля телефон вклчена автомассовая маска с кодом страны, то значение передавать в нее не нужно
                if (
                    !$(phoneInputSelector).closest(".t-input-phonemask__wrap")
                        .length
                )
                    $(phoneInputSelector).val(widgetData.contacts.phone);
                if (widgetData.contacts.email)
                    $emailInput.val(widgetData.contacts.email);

                $deliveryCompanyInput.val(
                    widgetData.delivery.deliveryCompanyName
                );
                $deliveryAddressInput.val(widgetData._meta.fullDeliveryAddress);
                switch (widgetData.delivery.type) {
                    case 1:
                        $deliveryTypeInput.val("Самовывоз");
                        break;
                    case 2:
                        $deliveryTypeInput.val("Курьерская");
                        break;
                    case 3:
                        $deliveryTypeInput.val("РџРѕС‡С‚Р°");
                        break;
                }

                $commentInput.val(widgetData.comment);

                $srIdlInput.val(response.id);

                $srOrderDataInput.val(widgetData._meta.commonDeliveryData);
                cookie.set("SafeRouteOrderID", response.id);
                cookie.set("SR_checkoutSessId", response.checkoutSessId);

                // Пересчет стоимости доставки в корзине
                setDeliveryPrice(getTotalPrice());
                // Разблокировка кнопки отправки формы
                $formSubmitBtn.prop("disabled", false);
                // Вывод информации о выбранной доставке
                $srDeliveryInfo.html(
                    "<div><b>" +
                        texts.selectedDelivery +
                        "</b></div>" +
                        "<div>" +
                        widgetData._meta.commonDeliveryData +
                        "</div>" +
                        '<div><a href="#" id="saferoute-change-delivery">' +
                        texts.changeDelivery +
                        "</a></div>"
                );

                if (!widgetData.delivery.CODAvailable) toggleCODPayment(false);

                // При оплате через встроенный эквайринг отправлять форму
                if (widgetData.payType === 2)
                    $(".t-form__submit .t-submit").trigger("click");
            });

            widget.on("error", (e) => console.error(e));
        }

        function SRRefresh() {
            if (SRIsSelected()) {
                runSRCartWidget();
                $orderForm.addClass("saferoute-selected");
            } else {
                if (widget) {
                    widget.destruct();
                    widget = null;
                }
                clearSRSelectedDelivery();
                $orderForm.removeClass("saferoute-selected");
            }
        }

        // Изменение выбранного способа доставки
        $deliverySelectRadio.on("change", function (e, noRefresh) {
            if (!noRefresh) SRRefresh();
        });

        // Изменение выбранного способа оплаты
        $("input[name=paymentsystem]").on("change", function () {
            if (SRIsSelected()) setDeliveryPrice(getTotalPrice());
        });

        // Клик по "Изменить способ доставки"
        $(document).on("click", "#saferoute-change-delivery", function (e) {
            e.preventDefault();
            runSRCartWidget();
        });

        // Открытие корзины
        const tcart__openCart_parent = tcart__openCart;
        window.tcart__openCart = function () {
            tcart__openCart_parent();
            updateTcartCopy();

            // Если доставка SafeRoute - единственный способ доставки, выбрать его сразу и скрыть переключатель
            if ($deliverySelectRadio.length === 1) {
                $deliverySelectRadio
                    .filter(function () {
                        const val = $(this).val().toLowerCase();

                        return options.srDeliveryName
                            ? val.includes(options.srDeliveryName.toLowerCase())
                            : /saferoute/i.test(val);
                    })
                    .trigger("click")
                    .closest(".t-input-group")
                    .hide();
            }

            SRRefresh();
        };

        // Изменение содержимого корзины
        const tcart__saveLocalObj_parent = tcart__saveLocalObj;
        window.tcart__saveLocalObj = function () {
            tcart__saveLocalObj_parent();

            if ($(".t706__cartwin").hasClass("t706__cartwin_showed"))
                SRRefresh();
        };

        // Применение промокода
        if (typeof tcart__addPromocode !== "undefined") {
            const tcart__addPromocode_parent = tcart__addPromocode;
            window.tcart__addPromocode = function (obj) {
                tcart__addPromocode_parent(obj);

                SRRefresh();
            };
        }
    }, 500);
};
