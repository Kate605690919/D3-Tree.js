//闭包实现插件的私有作用域,传入this方便将写好的组件绑到全局
(function (global) {
    const options = {
        color: d3.scale.category20c(),
        // Breadcrumb dimensions: width, height, spacing, width of tip/tail.
        b: {
            w: 75, h: 30, s: 3, t: 10
        }
    };
    class D3Tree {
        init({ query, data, info, flag }) {
            this.options = Object.assign({query, data, info, flag},options);
            let parent = document.querySelector(query)
            let parentStyle = window.getComputedStyle(parent, null);
            if (!this.options.height) this.options.height = parseInt(parentStyle.height);
            if (!this.options.width) this.options.width = parseInt(parentStyle.width);
            this.options.radius = Math.min(this.options.width, this.options.height) / 2;
            const { width, height, radius } = this.options;
            //导航条
            var trail = d3.select(query).append("svg:svg")
                .attr("width", width)
                .attr("height", 50)
                .attr("id", "trail");
            // 添加后面的数据区块
            trail.append("svg:text")
                .attr("id", "endlabel")
                .style("fill", "#000");

            this.svg = d3.select(query).append('svg')
                .attr('width', width)
                .attr('height', height)
                .append('g')
                .attr('transform', `translate(${width / 2},${height * .52})`);

            //Info部分样式
            let TreeInfo = document.createElement('div');
            TreeInfo.id = 'D3TreeInfo';
            TreeInfo.style.width = width + 'px';
            TreeInfo.style.textAlign = 'center';
            TreeInfo.style.marginTop = (-height*.52) + 'px';
            document.querySelector(query).appendChild(TreeInfo);

            info.forEach((item) => {
                d3.select('#D3TreeInfo').append('div').attr('id', 'D3TreeInfo' + item.name);
            });

            this.partition = d3.layout.partition()
                .sort(null)
                .size([2 * Math.PI, radius * radius])
                .value(function (d) { return 1; });

            this.arc = d3.svg.arc()
                .startAngle(function (d) { return d.x; })
                .endAngle(function (d) { return d.x + d.dx; })
                .innerRadius(function (d) { return Math.sqrt(d.y); })
                .outerRadius(function (d) { return Math.sqrt(d.y + d.dy); });
            this.buildJSON(data);
            this.render(data);
        }

        stash(d) {
            d.x0 = d.x;
            d.dx0 = d.dx;
        }
        //递归增加占位符，当拿到的数据父级并不等于子级之和时，增加name为'D3TreeNodePlaceHolder'的占位符
        //另：由于对象的赋值是引用类型，所以即使只改变形参，实参也会对应改变，也不用写return
        buildJSON(data) {
            if (data.children) {
                
                let sizeArray = data.children.map((item) => item.size);
                let sum = sizeArray.reduce((prev, cur) => prev + cur);
                let differ = data.size - sum;
                if(differ > 0) {
                    data.children.push({name:'D3TreeNodePlaceHolder',size: differ});
                }
                data.children.forEach((item) => {
                    this.buildJSON(item);
                });
            }
        }
        //获得层级序列
        getAncestors(node) {
            var path = [];
            var current = node;
            while (current.parent) {
                path.unshift(current);
                current = current.parent;
            }
            return path;
        }
        // Generate a string that describes the points of a breadcrumb polygon.
        breadcrumbPoints(d, i) {
            const b = this.options.b;
            var points = [];
            points.push("0,0");
            points.push(b.w + ",0");
            points.push(b.w + b.t + "," + (b.h / 2));
            points.push(b.w + "," + b.h);
            points.push("0," + b.h);
            if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
                points.push(b.t + "," + (b.h / 2));
            }
            return points.join(" ");
        }
        //更新层级序列导航
        updateBreadcrumbs(nodeArray, value) {
            let that = this;
            const b = this.options.b;
            // Data join; key function combines name and depth (= position in sequence).
            var g = d3.select("#trail")
                .selectAll("g")
                .data(nodeArray, function (d) { return d.name + d.depth; });

            // Add breadcrumb and label for entering nodes.
            var entering = g.enter().append("svg:g");

            entering.append("svg:polygon")
                .attr("points", (d,i)=>{this.breadcrumbPoints(d,i)})
                .style("fill", function (d) { return that.options.color((d.children ? d : d.parent).name); });

            entering.append("svg:text")
                .attr("x", (b.w + b.t) / 2)
                .attr("y", b.h / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .text(function (d) { return d.name; });

            // Set position for entering and updating nodes.
            g.attr("transform", function (d, i) {
                return "translate(" + i * (b.w + b.s) + ", 0)";
            });

            // Remove exiting nodes.
            g.exit().remove();

            // Now move and update the percentage at the end.
            d3.select("#trail").select("#endlabel")
                .attr("x", (nodeArray.length + 0.5) * (b.w + b.s))
                .attr("y", b.h / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .text(value);

            // Make the breadcrumb trail visible, if it's hidden.
            d3.select("#trail")
                .style("visibility", "");

        }
        // 鼠标悬停事件绑定，主要用于显示数据
        mouseover(d) {
            D3TreeInfo.style.display = (d.name === 'D3TreeNodePlaceHolder') ? 'none' : 'block';
            const {info, data} = this.options;
            info.forEach((item) => {
                d3.select('#D3TreeInfo' + item.name).text(`${item.name}: ${d[item.value]}`);
            });
            
            var sequenceArray = this.getAncestors(d);
            this.updateBreadcrumbs(sequenceArray, d.value);

            d3.selectAll("path").style("opacity", 0.3);
            this.svg.selectAll("path")
                .filter(function (node) {
                    return (sequenceArray.indexOf(node) >= 0);
                })
                .style("opacity", 1);

        }
        // 鼠标离开事件
        mouseleave(d) {
            d3.selectAll("path")
                .transition()
                .duration(1000)
                .style("opacity", 1);
        }
        render(data) {
            const that = this;
            let path = this.svg.datum(data).selectAll("path")
                .data(this.partition.nodes)
                .enter().append("path")
                .attr("display", function (d) { return d.depth ? null : "none"; }) // 内环不着色（display设为none）
                .attr("d", this.arc)
                .style("stroke", "#fff")
                .style("fill", function (d) { 
                    if(d.name === 'D3TreeNodePlaceHolder') return 'transparent'
                    else if (Math.abs(d[that.options.flag.key]) > that.options.flag.standard) return '#000'
                    return that.options.color((d.children ? d : d.parent).name); //占位符元素颜色设为透明
                })
                .style("fill-rule", "evenodd")
                .each(this.stash)
                .on("mouseover", (d)=>{
                    if (d.name !== 'D3TreeNodePlaceHolder') 
                    that.mouseover(d)});//通过此种方式，保证mouseover中的this还是当前的class，而不是d3中带的当前选中元素

            var value = function (d) { return d.size; };
            path.data(this.partition.value(value).nodes)
                .transition()
                .duration(1500)
                .attrTween("d", arcTween);//是不是attrTween这里封装有apply？改变了arcTween的上下文。所以吧arcTween单独拎出去写的时候，that.arc(b)那里会报错
            function arcTween(a) {
                let i = d3.interpolate({ x: a.x0, dx: a.dx0 }, a);
                return function (t) {
                    var b = i(t);
                    a.x0 = b.x;
                    a.dx0 = b.dx;
                    return that.arc(b);
                }
            }
            this.svg.on("mouseleave", (d) => {that.mouseleave(d)});
        }
    }
    global.d3Tree = new D3Tree(options);
})(this);
