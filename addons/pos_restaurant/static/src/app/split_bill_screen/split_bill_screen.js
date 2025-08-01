import { registry } from "@web/core/registry";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { Component, useState } from "@cashapp/owl";
import { Orderline } from "@point_of_sale/app/generic_components/orderline/orderline";
import { OrderWidget } from "@point_of_sale/app/generic_components/order_widget/order_widget";

export class SplitBillScreen extends Component {
    static template = "pos_restaurant.SplitBillScreen";
    static components = { Orderline, OrderWidget };
    static props = {};

    setup() {
        this.pos = usePos();
        this.qtyTracker = useState({});
        this.priceTracker = useState({});
    }

    get currentOrder() {
        return this.pos.get_order();
    }

    get orderlines() {
        return this.currentOrder.get_orderlines();
    }

    get newOrderPrice() {
        return Object.values(this.priceTracker).reduce((a, b) => a + b, 0);
    }

    onClickLine(line) {
        const lines = line.getAllLinesInCombo();

        for (const line of lines) {
            if (!line.get_unit()?.is_pos_groupable) {
                if (this.qtyTracker[line.uuid] === line.get_quantity()) {
                    this.qtyTracker[line.uuid] = 0;
                } else {
                    this.qtyTracker[line.uuid] = line.get_quantity();
                }
            } else if (!this.qtyTracker[line.uuid]) {
                this.qtyTracker[line.uuid] = 1;
            } else if (this.qtyTracker[line.uuid] === line.get_quantity()) {
                this.qtyTracker[line.uuid] = 0;
            } else {
                this.qtyTracker[line.uuid] += 1;
            }
            // We need this split for decimal quantities (e.g. 0.5 kg)
            if (this.qtyTracker[line.uuid] > line.get_quantity()) {
                this.qtyTracker[line.uuid] = line.get_quantity();
            }
            this.priceTracker[line.uuid] =
                (line.get_price_with_tax() / line.qty) * this.qtyTracker[line.uuid];
        }
    }

    _getOrderName(order) {
        return order.table_id?.table_number.toString() || order.getFloatingOrderName() || "";
    }

    _getLatestOrderNameStartingWith(name) {
        return (
            this.pos
                .get_open_orders()
                .map((order) => this._getOrderName(order))
                .filter((orderName) => orderName.slice(0, -1) === name)
                .sort((a, b) => a.slice(-1).localeCompare(b.slice(-1)))
                .at(-1) || name
        );
    }

    _getSplitOrderName(originalOrderName) {
        const latestOrderName = this._getLatestOrderNameStartingWith(originalOrderName);
        if (latestOrderName === originalOrderName) {
            return `${originalOrderName}B`;
        }
        const lastChar = latestOrderName[latestOrderName.length - 1];
        if (lastChar === "Z") {
            throw new Error("You cannot split the order into more than 26 parts!");
        }
        const nextChar = String.fromCharCode(lastChar.charCodeAt(0) + 1);
        return `${latestOrderName.slice(0, -1)}${nextChar}`;
    }

    // Meant to be overridden
    async preSplitOrder(originalOrder, newOrder) {}
    async postSplitOrder(originalOrder, newOrder) {}

    // Calculates the sent quantities for both orders and adjusts for last_order_preparation_change.
    _getSentQty(ogLine, newLine, orderedQty) {
        const unorderedQty = ogLine.qty - orderedQty;

        const delta = newLine.qty - unorderedQty;
        const newQty = delta > 0 ? delta : 0;

        return {
            [ogLine.preparationKey]: orderedQty - newQty,
            [newLine.preparationKey]: newQty,
        };
    }

    async createSplittedOrder() {
        const curOrderUuid = this.currentOrder.uuid;
        const originalOrder = this.pos.models["pos.order"].find((o) => o.uuid === curOrderUuid);
        this.pos.selectedTable = null;
        const originalOrderName = this._getOrderName(originalOrder);
        const newOrderName = this._getSplitOrderName(originalOrderName);

        const newOrder = this.pos.createNewOrder();
        newOrder.floating_order_name = newOrderName;
        newOrder.uiState.splittedOrderUuid = curOrderUuid;
        await this.preSplitOrder(originalOrder, newOrder);

        // Create lines for the new order
        const lineToDel = [];
        for (const line of originalOrder.lines) {
            if (this.qtyTracker[line.uuid]) {
                const data = line.serialize();
                delete data.uuid;
                const newLine = this.pos.models["pos.order.line"].create(
                    {
                        ...data,
                        qty: this.qtyTracker[line.uuid],
                        order_id: newOrder.id,
                    },
                    false,
                    true
                );

                const ordered =
                    originalOrder.last_order_preparation_change.lines[line.preparationKey];
                if (line.get_quantity() === this.qtyTracker[line.uuid]) {
                    delete originalOrder.last_order_preparation_change.lines[line.preparationKey];
                    lineToDel.push(line);

                    if (ordered) {
                        const newOrdered = { ...ordered };
                        newOrdered.uuid = newLine.uuid;
                        newOrder.last_order_preparation_change.lines[newLine.preparationKey] =
                            newOrdered;
                    }
                } else {
                    const newQty = line.get_quantity() - this.qtyTracker[line.uuid];
                    line.update({ qty: newQty });

                    if (ordered) {
                        const orderedQty = ordered["quantity"];
                        const newOrderedQty = orderedQty > newQty ? newQty : orderedQty;
                        ordered["quantity"] = newOrderedQty;

                        if (orderedQty > newQty) {
                            const newOrdered = { ...ordered };

                            newOrdered.uuid = newLine.uuid;
                            newOrdered.quantity = orderedQty - newQty;
                            newOrder.last_order_preparation_change.lines[newLine.preparationKey] =
                                newOrdered;
                        }
                    }
                }
            }
        }

        for (const line of lineToDel) {
            line.delete();
        }

        await this.pos.syncAllOrders({ orders: [originalOrder, newOrder] });
        originalOrder.customer_count -= 1;
        await this.postSplitOrder(originalOrder, newOrder);
        originalOrder.set_screen_data({ name: "ProductScreen" });
        this.pos.selectedOrderUuid = null;
        this.pos.set_order(newOrder);
        this.back();
    }

    getLineData(line) {
        const splitQty = this.qtyTracker[line.uuid];

        if (!splitQty) {
            return line.getDisplayData();
        }

        return { ...line.getDisplayData(), qty: `${splitQty} / ${line.get_quantity_str()}` };
    }

    back() {
        this.pos.showScreen("ProductScreen");
    }
}

registry.category("pos_screens").add("SplitBillScreen", SplitBillScreen);
